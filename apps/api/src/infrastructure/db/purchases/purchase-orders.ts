import type pg from "pg";
import type { Db } from "../pool.js";
import type { OrderInput, RequestItem } from "./purchases-types.js";

export function createPurchaseOrderMethods(
  db: Db,
  first: typeof import("./purchases-shared.js").purchaseFirst,
  transaction: typeof import("./purchases-shared.js").purchaseTransaction,
  validate: (c: pg.PoolClient, input: { empresaId: string; clienteId: string; proveedorId?: string; lugarEnvioDomicilioId?: string | null }, items: RequestItem[]) => Promise<void>,
) {
  async function genericDetail(kind: "order" | "warehouse", id: string) {
    const order = kind === "order";
    const table = order ? "ordenes_compra" : "pedidos_deposito",
      itemsTable = order ? "ordenes_compra_items" : "pedidos_deposito_items",
      fk = order ? "oc_id" : "pedido_deposito_id";
    const supplier = order ? ",to_jsonb(pr) proveedores" : "";
    const supplierJoin = order ? "join public.proveedores pr on pr.id=h.proveedor_id" : "";
    const extra = order
      ? `,(select ap.codigo_proveedor from public.articulos_proveedor ap join public.ordenes_compra oc on oc.id=i.oc_id
where ap.articulo_id=i.articulo_id and ap.proveedor_id=oc.proveedor_id limit 1) codigo_proveedor`
      : `,(select ap.precio::float from public.articulos_proveedor ap where ap.articulo_id=i.articulo_id
and ap.proveedor_id=a.proveedor_habitual_id and ap.activo=true limit 1) precio_referencia`;
    const [h, items] = await Promise.all([
      db.query(
        `select h.*,to_jsonb(e) empresas,jsonb_build_object('nombre',cl.nombre) clientes${supplier},
case when pc.id is null then null else jsonb_build_object('numero_pedido',pc.numero_pedido) end pedidos_compra
from public.${table} h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id
${supplierJoin} left join public.pedidos_compra pc on pc.id=h.pedido_id where h.id=$1`,
        [id],
      ),
      db.query(
        `select i.*,jsonb_build_object('id',a.id,'codigo_interno',a.codigo_interno,'nombre',a.nombre,'unidad',a.unidad,
'categoria',a.categoria,'proveedor_habitual_id',a.proveedor_habitual_id) articulos${extra}
from public.${itemsTable} i join public.articulos a on a.id=i.articulo_id
where i.${fk}=$1 order by i.created_at,i.id`,
        [id],
      ),
    ]);
    return { ...first(h.rows, "Record not found"), [itemsTable]: items.rows };
  }

  async function createOrder(input: OrderInput, actorId: string) {
    return transaction(db, async (c) => {
      await validate(c, input, input.items);
      const h = first(
        (
          await c.query(
            `insert into public.ordenes_compra(empresa_id,proveedor_id,cliente_id,pedido_id,observaciones_generales,
lugar_envio_texto,lugar_envio_alias,condicion_pago,horario_atencion_texto,estado,creado_por)
values($1,$2,$3,null,$4,$5,$6,$7,$8,'borrador',$9) returning *`,
            [
              input.empresaId,
              input.proveedorId,
              input.clienteId,
              input.observacionesGenerales ?? null,
              input.lugarEnvioTexto ?? null,
              input.lugarEnvioAlias ?? null,
              input.condicionPago ?? null,
              input.horarioAtencionTexto ?? null,
              actorId,
            ],
          )
        ).rows,
        "Create failed",
      );
      for (const i of input.items)
        await c.query(
          "insert into public.ordenes_compra_items(oc_id,articulo_id,cantidad,precio_unitario,observaciones) values($1,$2,$3,$4,$5)",
          [h.id, i.articuloId, i.cantidad, i.precioUnitario, i.observaciones ?? null],
        );
      return h;
    });
  }

  return { 
    genericDetail,
    createOrder, 
  }
}
