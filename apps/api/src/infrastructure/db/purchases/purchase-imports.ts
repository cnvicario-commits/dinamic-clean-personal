import type pg from "pg";
import type { Db } from "../pool.js";
import type { ImportInput, RequestItem } from "./purchases-types.js";

export function createPurchaseImportMethods(
  db: Db,
  first: typeof import("./purchases-shared.js").purchaseFirst,
  validate: (c: pg.PoolClient, input: { empresaId: string; clienteId: string; proveedorId?: string; lugarEnvioDomicilioId?: string | null }, items: RequestItem[]) => Promise<void>,
  idempotent: ReturnType<typeof import("./purchases-idempotency.js").createPurchaseIdempotency>,
) {
  async function previewImport(input: ImportInput) {
    const errors: Array<{ row: number; message: string }> = [],
      seen = new Set<string>();
    for (let i = 0; i < input.orders.length; i++) {
      const o = input.orders[i]!;
      if (!(await db.query("select 1 from public.clientes where id=$1", [o.clienteId])).rowCount)
        errors.push({ row: i + 1, message: "Client not found" });
      if (
        o.clienteDomicilioId &&
        !(
          await db.query("select 1 from public.cliente_domicilios where id=$1 and cliente_id=$2", [
            o.clienteDomicilioId,
            o.clienteId,
          ])
        ).rowCount
      )
        errors.push({ row: i + 1, message: "Address does not belong to client" });
      const destination = `${o.clienteId}:${o.clienteDomicilioId ?? ""}`;
      if (seen.has(destination))
        errors.push({ row: i + 1, message: "Duplicate client/address destination" });
      seen.add(destination);
      const ids = [...new Set(o.items.map((x) => x.articuloId))];
      if (
        (await db.query("select id from public.articulos where id=any($1::uuid[])", [ids]))
          .rowCount !== ids.length
      )
        errors.push({ row: i + 1, message: "Article not found" });
    }
    const invalidRows = new Set(errors.map((e) => e.row));
    return {
      total: input.orders.length,
      valid: input.orders.length - invalidRows.size,
      invalid: invalidRows.size,
      clientsFound:
        input.orders.length - errors.filter((e) => e.message === "Client not found").length,
      addressesFound:
        input.orders.filter((o) => o.clienteDomicilioId).length -
        errors.filter((e) => e.message === "Address does not belong to client").length,
      articles: input.orders.reduce((n, o) => n + o.items.length, 0),
      duplicates: errors.filter((e) => e.message.startsWith("Duplicate")).length,
      conflicts: errors.length,
      errors,
    };
  }

  async function applyImport(input: ImportInput, key: string, actorId: string) {
    return idempotent(actorId, "purchase_request_import", key, input, async (c) => {
      const ids: string[] = [];
      for (const o of input.orders) {
        await validate(c, { ...o, empresaId: input.empresaId }, o.items);
        const h = first(
          (
            await c.query(
              `insert into public.pedidos_compra(empresa_id,cliente_id,lugar_envio_domicilio_id,lugar_envio_texto,lugar_envio_alias,estado,creado_por)
values($1,$2,$3,$4,$5,'borrador',$6) returning id`,
              [
                input.empresaId,
                o.clienteId,
                o.clienteDomicilioId ?? null,
                o.lugarEnvioTexto ?? null,
                o.lugarEnvioAlias ?? null,
                actorId,
              ],
            )
          ).rows,
          "Create failed",
        );
        ids.push(String(h.id));
        for (const item of o.items)
          await c.query(
            "insert into public.pedidos_compra_items(pedido_id,articulo_id,cantidad,observaciones) values($1,$2,$3,$4)",
            [h.id, item.articuloId, item.cantidad, item.observaciones ?? null],
          );
      }
      return { purchaseRequestIds: ids };
    });
  }

  return { 
    previewImport,
    applyImport, 
  }
}
