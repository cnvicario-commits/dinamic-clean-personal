import type pg from "pg";
import type { Db } from "../pool.js";
import { AppError, conflict } from "../../../http/errors/app-error.js";
import type { Note, RequestInput, RequestItem } from "./purchases-types.js";

export function createPurchaseRequestMethods(
  db: Db,
  first: typeof import("./purchases-shared.js").purchaseFirst,
  transaction: typeof import("./purchases-shared.js").purchaseTransaction,
) {
  async function validate(
    c: pg.PoolClient,
    input: {
      empresaId: string;
      clienteId: string;
      proveedorId?: string | undefined;
      lugarEnvioDomicilioId?: string | null | undefined;
    },
    items: RequestItem[],
  ) {
    if (
      !(
        await c.query("select 1 from public.empresas where id=$1 and activo=true", [
          input.empresaId,
        ])
      ).rowCount
    )
      throw new AppError(400, "invalid_company", "Company not found or inactive");
    if (!(await c.query("select 1 from public.clientes where id=$1", [input.clienteId])).rowCount)
      throw new AppError(400, "invalid_client", "Client not found");
    if (
      input.proveedorId &&
      !(
        await c.query("select 1 from public.proveedores where id=$1 and activo=true", [
          input.proveedorId,
        ])
      ).rowCount
    )
      throw new AppError(400, "invalid_supplier", "Supplier not found or inactive");
    if (
      input.lugarEnvioDomicilioId &&
      !(
        await c.query(
          "select 1 from public.cliente_domicilios where id=$1 and cliente_id=$2 and activo=true",
          [input.lugarEnvioDomicilioId, input.clienteId],
        )
      ).rowCount
    )
      throw new AppError(400, "invalid_address", "Address does not belong to client");
    const ids = [...new Set(items.map((x) => x.articuloId))];
    if (
      (await c.query("select id from public.articulos where id=any($1::uuid[])", [ids]))
        .rowCount !== ids.length
    )
      throw new AppError(400, "invalid_article", "Article not found");
  }

  async function requestDetail(
    id: string,
  ): Promise<Record<string, unknown> & { pedidos_compra_items: pg.QueryResultRow[] }> {
    const [header, items] = await Promise.all([
      db.query(
        `select h.*,to_jsonb(e) empresas,jsonb_build_object('nombre',cl.nombre) clientes,
case when d.id is null then null else jsonb_build_object('alias',d.alias,'direccion',d.direccion) end cliente_domicilios
from public.pedidos_compra h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id
left join public.cliente_domicilios d on d.id=h.lugar_envio_domicilio_id where h.id=$1`,
        [id],
      ),
      db.query(
        `select i.*,jsonb_build_object('id',a.id,'codigo_interno',a.codigo_interno,'nombre',a.nombre,'unidad',a.unidad,
'categoria',a.categoria,'proveedor_habitual_id',a.proveedor_habitual_id) articulos,
coalesce((select sum(oi.cantidad) from public.ordenes_compra_items oi where oi.pedido_compra_item_id=i.id),0)::float cantidad_asignada_oc,
coalesce((select sum(di.cantidad) from public.pedidos_deposito_items di where di.pedido_compra_item_id=i.id),0)::float cantidad_asignada_deposito
from public.pedidos_compra_items i join public.articulos a on a.id=i.articulo_id where i.pedido_id=$1 order by i.created_at,i.id`,
        [id],
      ),
    ]);
    return {
      ...first<Record<string, unknown>>(header.rows, "Purchase request not found"),
      pedidos_compra_items: items.rows,
    };
  }
  async function saveRequest(input: RequestInput, actorId: string, id?: string) {
    const header = await transaction(db, async (c) => {
      await validate(c, input, input.items);
      let saved: pg.QueryResultRow;
      if (id) {
        const current = first(
          (await c.query("select * from public.pedidos_compra where id=$1 for update", [id])).rows,
          "Purchase request not found",
        );
        if (current.estado !== "borrador")
          throw conflict("Only draft purchase requests can be edited");
        saved = first(
          (
            await c.query(
              `update public.pedidos_compra set empresa_id=$2,cliente_id=$3,observaciones_generales=$4,
lugar_envio_domicilio_id=$5,lugar_envio_empresa=$6,lugar_envio_texto=$7,lugar_envio_alias=$8,estado=$9
where id=$1 returning *`,
              [
                id,
                input.empresaId,
                input.clienteId,
                input.observacionesGenerales ?? null,
                input.lugarEnvioDomicilioId ?? null,
                input.lugarEnvioEmpresa ?? false,
                input.lugarEnvioTexto ?? null,
                input.lugarEnvioAlias ?? null,
                input.estado ?? "borrador",
              ],
            )
          ).rows,
          "Purchase request not found",
        );
        await c.query("delete from public.pedidos_compra_items where pedido_id=$1", [id]);
      } else {
        saved = first(
          (
            await c.query(
              `insert into public.pedidos_compra(empresa_id,cliente_id,observaciones_generales,lugar_envio_domicilio_id,
lugar_envio_empresa,lugar_envio_texto,lugar_envio_alias,estado,creado_por)
values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
              [
                input.empresaId,
                input.clienteId,
                input.observacionesGenerales ?? null,
                input.lugarEnvioDomicilioId ?? null,
                input.lugarEnvioEmpresa ?? false,
                input.lugarEnvioTexto ?? null,
                input.lugarEnvioAlias ?? null,
                input.estado ?? "borrador",
                actorId,
              ],
            )
          ).rows,
          "Create failed",
        );
      }
      for (const item of input.items)
        await c.query(
          "insert into public.pedidos_compra_items(pedido_id,articulo_id,cantidad,observaciones) values($1,$2,$3,$4)",
          [saved.id, item.articuloId, item.cantidad, item.observaciones ?? null],
        );
      return saved;
    });
    return requestDetail(String(header.id));
  }

  async function transition(
    table: "pedidos_compra" | "ordenes_compra" | "pedidos_deposito",
    id: string,
    next: string,
  ) {
    const allowed: Record<string, Record<string, string[]>> = {
      pedidos_compra: { borrador: ["enviada"] },
      ordenes_compra: { borrador: ["enviada"], enviada: ["recepcionada"] },
      pedidos_deposito: { borrador: ["enviada"], enviada: ["recepcionada"] },
    };
    return transaction(db, async (c) => {
      const old = first(
        (await c.query(`select estado from public.${table} where id=$1 for update`, [id])).rows,
        "Record not found",
      );
      if (!(allowed[table]![String(old.estado)] ?? []).includes(next))
        throw new AppError(
          409,
          "invalid_state_transition",
          `Cannot transition ${String(old.estado)} to ${next}`,
        );
      return first(
        (await c.query(`update public.${table} set estado=$2 where id=$1 returning *`, [id, next]))
          .rows,
        "Record not found",
      );
    });
  }

  function discard(id: string, input: { descartada: boolean; motivo?: Note }) {
    return transaction(db, async (c) => {
      const row = first(
        (
          await c.query(
            "select i.id,p.estado from public.pedidos_compra_items i join public.pedidos_compra p on p.id=i.pedido_id where i.id=$1 for update of i,p",
            [id],
          )
        ).rows,
        "Item not found",
      );
      if (row.estado !== "enviada")
        throw conflict("Items can only be discarded while the request is sent");
      return first(
        (
          await c.query(
            "update public.pedidos_compra_items set descartada=$2,motivo_descarte=$3 where id=$1 returning *",
            [id, input.descartada, input.motivo ?? null],
          )
        ).rows,
        "Item not found",
      );
    });
  }
  return { 
    validate,
    requestDetail,
    saveRequest,
    transition,
    discard,
  };
}
