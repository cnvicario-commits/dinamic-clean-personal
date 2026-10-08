import { AppError, conflict } from "../../../http/errors/app-error.js";
import type { AssignInput, Assignment } from "./purchases-types.js";

type First = typeof import("./purchases-shared.js").purchaseFirst;
type Idempotent = ReturnType<typeof import("./purchases-idempotency.js").createPurchaseIdempotency>;

export function createPurchaseAssignmentMethods(first: First, idempotent: Idempotent) {
  async function applyAssignments(
    pedidoId: string,
    input: AssignInput,
    key: string,
    actorId: string,
  ) {
    return idempotent(actorId, "purchase_order_generate", key, input, async (c) => {
      const pedido = first(
        (
          await c.query(
            "select * from public.pedidos_compra where id=$1 and estado='enviada' for update",
            [pedidoId],
          )
        ).rows,
        "Sent purchase request not found",
      );
      const ids = [...new Set(input.items.map((i) => i.pedidoCompraItemId))];
      const source = await c.query(
        "select * from public.pedidos_compra_items where pedido_id=$1 and id=any($2::uuid[]) order by id for update",
        [pedidoId, ids],
      );
      if (source.rowCount !== ids.length)
        throw new AppError(
          400,
          "invalid_assignment_item",
          "Item does not belong to purchase request",
        );
      const sums = await c.query(
        `select source_id,sum(qty)::float qty from (
select pedido_compra_item_id source_id,cantidad qty from public.ordenes_compra_items where pedido_compra_item_id=any($1::uuid[])
union all select pedido_compra_item_id,cantidad from public.pedidos_deposito_items where pedido_compra_item_id=any($1::uuid[])
) q group by source_id`,
        [ids],
      );
      const used = new Map(sums.rows.map((r) => [String(r.source_id), Number(r.qty)]));
      for (const s of source.rows) {
        if (s.descartada) throw conflict("Discarded items cannot be assigned");
        const add = input.items
          .filter((i) => i.pedidoCompraItemId === s.id)
          .reduce((n, i) => n + i.cantidad, 0);
        if ((used.get(String(s.id)) ?? 0) + add > Number(s.cantidad))
          throw new AppError(
            409,
            "purchase_item_overallocated",
            "Assignment exceeds pending quantity",
          );
      }
      const orderIds: string[] = [];
      const groups = new Map<string, Assignment[]>();
      for (const i of input.items.filter((i) => i.destino !== "deposito"))
        groups.set(i.proveedorId!, [...(groups.get(i.proveedorId!) ?? []), i]);
      for (const [supplierId, items] of groups) {
        const supplier = first(
          (
            await c.query("select * from public.proveedores where id=$1 and activo=true", [
              supplierId,
            ])
          ).rows,
          "Supplier not found",
        );
        const h = first(
          (
            await c.query(
              `insert into public.ordenes_compra(empresa_id,proveedor_id,cliente_id,pedido_id,lugar_envio_texto,lugar_envio_alias,
horario_atencion_texto,condicion_pago,estado,creado_por) values($1,$2,$3,$4,$5,$6,$7,$8,'borrador',$9) returning id`,
              [
                pedido.empresa_id,
                supplierId,
                pedido.cliente_id,
                pedidoId,
                input.lugarEnvioTexto ?? null,
                input.lugarEnvioAlias ?? null,
                input.horarioAtencionTexto ?? null,
                supplier.condicion_pago_default,
                actorId,
              ],
            )
          ).rows,
          "Create failed",
        );
        orderIds.push(String(h.id));
        for (const i of items)
          await c.query(
            `insert into public.ordenes_compra_items(oc_id,pedido_compra_item_id,articulo_id,cantidad,precio_unitario,observaciones)
select $1,$2,articulo_id,$3,$4,$5 from public.pedidos_compra_items where id=$6`,
            [
              h.id,
              i.destino === "proveedor" ? i.pedidoCompraItemId : null,
              i.cantidad,
              i.precioUnitario,
              i.observaciones ?? null,
              i.pedidoCompraItemId,
            ],
          );
      }
      const warehouse = input.items.filter((i) => i.destino !== "proveedor");
      let warehouseId: string | null = null;
      if (warehouse.length) {
        const h = first(
          (
            await c.query(
              "insert into public.pedidos_deposito(empresa_id,cliente_id,pedido_id,lugar_envio_texto,lugar_envio_alias,estado,creado_por) values($1,$2,$3,$4,$5,'borrador',$6) returning id",
              [
                pedido.empresa_id,
                pedido.cliente_id,
                pedidoId,
                input.lugarEnvioTexto ?? null,
                input.lugarEnvioAlias ?? null,
                actorId,
              ],
            )
          ).rows,
          "Create failed",
        );
        warehouseId = String(h.id);
        for (const i of warehouse)
          await c.query(
            `insert into public.pedidos_deposito_items(pedido_deposito_id,pedido_compra_item_id,articulo_id,cantidad,observaciones)
select $1,$2,articulo_id,$3,$4 from public.pedidos_compra_items where id=$2`,
            [h.id, i.pedidoCompraItemId, i.cantidad, i.observaciones ?? null],
          );
      }
      return { purchaseOrderIds: orderIds, warehouseRequestId: warehouseId };
    });
  }

  return {
    applyAssignments,
  };
}
