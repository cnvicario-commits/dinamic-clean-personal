import type pg from "pg";
import type { Db } from "../pool.js";
import type { Note, RequestInput } from "./purchases-types.js";

export function createPurchaseDuplicateMethods(
  db: Db,
  first: typeof import("./purchases-shared.js").purchaseFirst,
  transaction: typeof import("./purchases-shared.js").purchaseTransaction,
  requestDetail: (id: string) => Promise<Record<string, unknown> & { pedidos_compra_items: pg.QueryResultRow[] }>,
  saveRequest: (input: RequestInput, actorId: string, id?: string) => Promise<unknown>,
) {
  async function duplicate(kind: "request" | "order" | "warehouse", id: string, actorId: string) {
    if (kind === "request") {
      const d = await requestDetail(id);
      return saveRequest(
        {
          empresaId: String(d.empresa_id),
          clienteId: String(d.cliente_id),
          observacionesGenerales: d.observaciones_generales as Note,
          lugarEnvioDomicilioId: d.lugar_envio_domicilio_id as string | null,
          lugarEnvioEmpresa: Boolean(d.lugar_envio_empresa),
          lugarEnvioTexto: d.lugar_envio_texto as Note,
          lugarEnvioAlias: d.lugar_envio_alias as Note,
          items: (d.pedidos_compra_items as Array<Record<string, unknown>>).map((i) => ({
            articuloId: String(i.articulo_id),
            cantidad: Number(i.cantidad),
            observaciones: i.observaciones as Note,
          })),
        },
        actorId,
      );
    }
    return transaction(db, async (c) => {
      const order = kind === "order",
        table = order ? "ordenes_compra" : "pedidos_deposito",
        items = order ? "ordenes_compra_items" : "pedidos_deposito_items",
        fk = order ? "oc_id" : "pedido_deposito_id";
      const h = first(
        (await c.query(`select * from public.${table} where id=$1 for update`, [id])).rows,
        "Record not found",
      );
      let nh;
      if (order) {
        nh = first(
          (
            await c.query(
              `insert into public.ordenes_compra(empresa_id,proveedor_id,cliente_id,pedido_id,observaciones_generales,
lugar_envio_texto,lugar_envio_alias,condicion_pago,horario_atencion_texto,estado,creado_por)
values($1,$2,$3,null,$4,$5,$6,$7,$8,'borrador',$9) returning *`,
              [
                h.empresa_id,
                h.proveedor_id,
                h.cliente_id,
                h.observaciones_generales,
                h.lugar_envio_texto,
                h.lugar_envio_alias,
                h.condicion_pago,
                h.horario_atencion_texto,
                actorId,
              ],
            )
          ).rows,
          "Create failed",
        );
        await c.query(
          `insert into public.${items}(oc_id,articulo_id,pedido_compra_item_id,cantidad,precio_unitario,observaciones)
select $1,articulo_id,null,cantidad,precio_unitario,observaciones from public.${items} where ${fk}=$2`,
          [nh.id, id],
        );
      } else {
        nh = first(
          (
            await c.query(
              `insert into public.pedidos_deposito(empresa_id,cliente_id,pedido_id,observaciones_generales,lugar_envio_texto,lugar_envio_alias,estado,creado_por)
values($1,$2,null,$3,$4,$5,'borrador',$6) returning *`,
              [
                h.empresa_id,
                h.cliente_id,
                h.observaciones_generales,
                h.lugar_envio_texto,
                h.lugar_envio_alias,
                actorId,
              ],
            )
          ).rows,
          "Create failed",
        );
        await c.query(
          `insert into public.${items}(pedido_deposito_id,articulo_id,pedido_compra_item_id,cantidad,observaciones)
select $1,articulo_id,null,cantidad,observaciones from public.${items} where ${fk}=$2`,
          [nh.id, id],
        );
      }
      return nh;
    });
  }

  return { 
    duplicate, 
  }
}
