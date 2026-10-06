import { createHash } from "node:crypto";
import type pg from "pg";
import type { Db } from "./pool.js";
import { AppError, conflict, notFound } from "../../http/errors/app-error.js";

type Note = string | null | undefined;
type RequestItem = { articuloId: string; cantidad: number; observaciones?: Note };
type RequestInput = {
  empresaId: string;
  clienteId: string;
  observacionesGenerales?: Note;
  lugarEnvioDomicilioId?: string | null | undefined;
  lugarEnvioEmpresa?: boolean | undefined;
  lugarEnvioTexto?: Note;
  lugarEnvioAlias?: Note;
  estado?: "borrador" | "enviada" | undefined;
  items: RequestItem[];
};
type OrderItem = RequestItem & { precioUnitario: number };
type OrderInput = {
  empresaId: string;
  proveedorId: string;
  clienteId: string;
  observacionesGenerales?: Note;
  lugarEnvioTexto?: Note;
  lugarEnvioAlias?: Note;
  condicionPago?: Note;
  horarioAtencionTexto?: Note;
  items: OrderItem[];
};
type Assignment = {
  pedidoCompraItemId: string;
  destino: "proveedor" | "deposito" | "proveedor_deposito";
  proveedorId?: string | null | undefined;
  cantidad: number;
  precioUnitario?: number | null | undefined;
  observaciones?: Note;
};
type AssignInput = {
  lugarEnvioTexto?: Note;
  lugarEnvioAlias?: Note;
  horarioAtencionTexto?: Note;
  items: Assignment[];
};
type ImportInput = {
  empresaId: string;
  orders: Array<{
    clienteId: string;
    clienteDomicilioId?: string | null | undefined;
    lugarEnvioTexto?: Note;
    lugarEnvioAlias?: Note;
    items: RequestItem[];
  }>;
};

async function transaction<T>(db: Db, run: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.pool.connect();
  try {
    await c.query("begin");
    const result = await run(c);
    await c.query("commit");
    return result;
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
function first<T extends pg.QueryResultRow>(rows: T[], message: string): T {
  if (!rows[0]) throw notFound(message);
  return rows[0];
}

export function createPurchasesRepository(db: Db) {
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
        "select h.*,to_jsonb(e) empresas,jsonb_build_object('nombre',cl.nombre) clientes,case when d.id is null then null else jsonb_build_object('alias',d.alias,'direccion',d.direccion) end cliente_domicilios from public.pedidos_compra h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id left join public.cliente_domicilios d on d.id=h.lugar_envio_domicilio_id where h.id=$1",
        [id],
      ),
      db.query(
        "select i.*,jsonb_build_object('id',a.id,'codigo_interno',a.codigo_interno,'nombre',a.nombre,'unidad',a.unidad,'categoria',a.categoria,'proveedor_habitual_id',a.proveedor_habitual_id) articulos,coalesce((select sum(oi.cantidad) from public.ordenes_compra_items oi where oi.pedido_compra_item_id=i.id),0)::float cantidad_asignada_oc,coalesce((select sum(di.cantidad) from public.pedidos_deposito_items di where di.pedido_compra_item_id=i.id),0)::float cantidad_asignada_deposito from public.pedidos_compra_items i join public.articulos a on a.id=i.articulo_id where i.pedido_id=$1 order by i.created_at,i.id",
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
              "update public.pedidos_compra set empresa_id=$2,cliente_id=$3,observaciones_generales=$4,lugar_envio_domicilio_id=$5,lugar_envio_empresa=$6,lugar_envio_texto=$7,lugar_envio_alias=$8,estado=$9 where id=$1 returning *",
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
              "insert into public.pedidos_compra(empresa_id,cliente_id,observaciones_generales,lugar_envio_domicilio_id,lugar_envio_empresa,lugar_envio_texto,lugar_envio_alias,estado,creado_por) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
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
  async function genericDetail(kind: "order" | "warehouse", id: string) {
    const order = kind === "order";
    const table = order ? "ordenes_compra" : "pedidos_deposito",
      itemsTable = order ? "ordenes_compra_items" : "pedidos_deposito_items",
      fk = order ? "oc_id" : "pedido_deposito_id";
    const supplier = order ? ",to_jsonb(pr) proveedores" : "";
    const supplierJoin = order ? "join public.proveedores pr on pr.id=h.proveedor_id" : "";
    const extra = order
      ? ",(select ap.codigo_proveedor from public.articulos_proveedor ap join public.ordenes_compra oc on oc.id=i.oc_id where ap.articulo_id=i.articulo_id and ap.proveedor_id=oc.proveedor_id limit 1) codigo_proveedor"
      : ",(select ap.precio::float from public.articulos_proveedor ap where ap.articulo_id=i.articulo_id and ap.proveedor_id=a.proveedor_habitual_id and ap.activo=true limit 1) precio_referencia";
    const [h, items] = await Promise.all([
      db.query(
        `select h.*,to_jsonb(e) empresas,jsonb_build_object('nombre',cl.nombre) clientes${supplier},case when pc.id is null then null else jsonb_build_object('numero_pedido',pc.numero_pedido) end pedidos_compra from public.${table} h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id ${supplierJoin} left join public.pedidos_compra pc on pc.id=h.pedido_id where h.id=$1`,
        [id],
      ),
      db.query(
        `select i.*,jsonb_build_object('id',a.id,'codigo_interno',a.codigo_interno,'nombre',a.nombre,'unidad',a.unidad,'categoria',a.categoria,'proveedor_habitual_id',a.proveedor_habitual_id) articulos${extra} from public.${itemsTable} i join public.articulos a on a.id=i.articulo_id where i.${fk}=$1 order by i.created_at,i.id`,
        [id],
      ),
    ]);
    return { ...first(h.rows, "Record not found"), [itemsTable]: items.rows };
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
  async function createOrder(input: OrderInput, actorId: string) {
    return transaction(db, async (c) => {
      await validate(c, input, input.items);
      const h = first(
        (
          await c.query(
            "insert into public.ordenes_compra(empresa_id,proveedor_id,cliente_id,pedido_id,observaciones_generales,lugar_envio_texto,lugar_envio_alias,condicion_pago,horario_atencion_texto,estado,creado_por) values($1,$2,$3,null,$4,$5,$6,$7,$8,'borrador',$9) returning *",
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
  async function idempotent<T extends object>(
    actorId: string,
    operation: "purchase_request_import" | "purchase_order_generate",
    key: string,
    payload: unknown,
    run: (c: pg.PoolClient) => Promise<T>,
  ) {
    const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return transaction(db, async (c) => {
      await c.query(
        "insert into public.purchase_operation_idempotency(actor_id,operation,idempotency_key,payload_hash,status) values($1,$2,$3,$4,'PROCESSING') on conflict do nothing",
        [actorId, operation, key, hash],
      );
      const row = first(
        (
          await c.query(
            "select * from public.purchase_operation_idempotency where actor_id=$1 and operation=$2 and idempotency_key=$3 for update",
            [actorId, operation, key],
          )
        ).rows,
        "Idempotency row missing",
      );
      if (row.payload_hash !== hash)
        throw new AppError(
          409,
          "idempotency_key_payload_mismatch",
          "Idempotency-Key already used with a different payload",
        );
      if (row.status === "COMPLETED") return { replayed: true, response: row.response as T };
      const response = await run(c);
      await c.query(
        "update public.purchase_operation_idempotency set status='COMPLETED',response=$4,updated_at=now() where actor_id=$1 and operation=$2 and idempotency_key=$3",
        [actorId, operation, key, response],
      );
      return { replayed: false, response };
    });
  }
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
        "select source_id,sum(qty)::float qty from (select pedido_compra_item_id source_id,cantidad qty from public.ordenes_compra_items where pedido_compra_item_id=any($1::uuid[]) union all select pedido_compra_item_id,cantidad from public.pedidos_deposito_items where pedido_compra_item_id=any($1::uuid[])) q group by source_id",
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
              "insert into public.ordenes_compra(empresa_id,proveedor_id,cliente_id,pedido_id,lugar_envio_texto,lugar_envio_alias,horario_atencion_texto,condicion_pago,estado,creado_por) values($1,$2,$3,$4,$5,$6,$7,$8,'borrador',$9) returning id",
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
            "insert into public.ordenes_compra_items(oc_id,pedido_compra_item_id,articulo_id,cantidad,precio_unitario,observaciones) select $1,$2,articulo_id,$3,$4,$5 from public.pedidos_compra_items where id=$6",
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
            "insert into public.pedidos_deposito_items(pedido_deposito_id,pedido_compra_item_id,articulo_id,cantidad,observaciones) select $1,$2,articulo_id,$3,$4 from public.pedidos_compra_items where id=$2",
            [h.id, i.pedidoCompraItemId, i.cantidad, i.observaciones ?? null],
          );
      }
      return { purchaseOrderIds: orderIds, warehouseRequestId: warehouseId };
    });
  }
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
              "insert into public.pedidos_compra(empresa_id,cliente_id,lugar_envio_domicilio_id,lugar_envio_texto,lugar_envio_alias,estado,creado_por) values($1,$2,$3,$4,$5,'borrador',$6) returning id",
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
              "insert into public.ordenes_compra(empresa_id,proveedor_id,cliente_id,pedido_id,observaciones_generales,lugar_envio_texto,lugar_envio_alias,condicion_pago,horario_atencion_texto,estado,creado_por) values($1,$2,$3,null,$4,$5,$6,$7,$8,'borrador',$9) returning *",
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
          `insert into public.${items}(oc_id,articulo_id,pedido_compra_item_id,cantidad,precio_unitario,observaciones) select $1,articulo_id,null,cantidad,precio_unitario,observaciones from public.${items} where ${fk}=$2`,
          [nh.id, id],
        );
      } else {
        nh = first(
          (
            await c.query(
              "insert into public.pedidos_deposito(empresa_id,cliente_id,pedido_id,observaciones_generales,lugar_envio_texto,lugar_envio_alias,estado,creado_por) values($1,$2,null,$3,$4,$5,'borrador',$6) returning *",
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
          `insert into public.${items}(pedido_deposito_id,articulo_id,pedido_compra_item_id,cantidad,observaciones) select $1,articulo_id,null,cantidad,observaciones from public.${items} where ${fk}=$2`,
          [nh.id, id],
        );
      }
      return nh;
    });
  }
  const catalogs = () =>
    Promise.all([
      db.query(
        "select id,nombre,cuit,domicilio,activo from public.empresas where activo=true order by nombre",
      ),
      db.query("select id,nombre from public.clientes order by nombre"),
      db.query(
        "select id,codigo_interno,nombre,unidad,categoria,proveedor_habitual_id from public.articulos where activo=true order by nombre",
      ),
      db.query(
        "select id,cliente_id,alias,direccion,es_principal,activo,horario_atencion from public.cliente_domicilios where activo=true order by alias",
      ),
      db.query(
        "select id,razon_social,domicilio,provincia,condicion_pago_default from public.proveedores where activo=true order by razon_social",
      ),
      db.query(
        "select articulo_id,proveedor_id,precio from public.articulos_proveedor where activo=true",
      ),
    ]).then(([a, b, c, d, e, f]) => ({
      empresas: a.rows,
      clientes: b.rows,
      articulos: c.rows,
      domicilios: d.rows,
      proveedores: e.rows,
      preciosProveedor: f.rows,
    }));
  const listRequests = () =>
    db
      .query(
        "select h.*,jsonb_build_object('nombre',e.nombre) empresas,jsonb_build_object('nombre',cl.nombre) clientes,p.nombre_completo creado_por_nombre,case when exists(select 1 from public.pedidos_compra_items i where i.pedido_id=h.id) then not exists(select 1 from public.pedidos_compra_items i where i.pedido_id=h.id and not i.descartada and i.cantidad>coalesce((select sum(x.cantidad) from (select cantidad from public.ordenes_compra_items where pedido_compra_item_id=i.id union all select cantidad from public.pedidos_deposito_items where pedido_compra_item_id=i.id)x),0)) else false end procesado from public.pedidos_compra h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id left join public.perfiles p on p.id=h.creado_por order by h.created_at desc",
      )
      .then((r) => r.rows);
  const listOrders = () =>
    db
      .query(
        "select h.*,jsonb_build_object('nombre',e.nombre) empresas,jsonb_build_object('nombre',cl.nombre) clientes,jsonb_build_object('razon_social',p.razon_social) proveedores from public.ordenes_compra h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id join public.proveedores p on p.id=h.proveedor_id order by h.created_at desc",
      )
      .then((r) => r.rows);
  const listWarehouses = () =>
    db
      .query(
        "select h.*,jsonb_build_object('nombre',e.nombre) empresas,jsonb_build_object('nombre',cl.nombre) clientes,p.nombre_completo creado_por_nombre from public.pedidos_deposito h join public.empresas e on e.id=h.empresa_id join public.clientes cl on cl.id=h.cliente_id left join public.perfiles p on p.id=h.creado_por order by h.created_at desc",
      )
      .then((r) => r.rows);
  return {
    catalogs,
    listRequests,
    requestDetail,
    saveRequest,
    transition,
    createOrder,
    orderDetail: (id: string) => genericDetail("order", id),
    warehouseDetail: (id: string) => genericDetail("warehouse", id),
    listOrders,
    listWarehouses,
    applyAssignments,
    previewImport,
    applyImport,
    duplicate,
    discard: (id: string, input: { descartada: boolean; motivo?: Note }) =>
      transaction(db, async (c) => {
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
      }),
  };
}
export type PurchasesRepository = ReturnType<typeof createPurchasesRepository>;
