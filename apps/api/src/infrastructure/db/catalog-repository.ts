import type { Db } from "./pool.js";
import type pg from "pg";
import { AppError, conflict, notFound } from "../../http/errors/app-error.js";
const s = (x: string) => x.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const normalizeSupplierCode = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, "").toLowerCase();
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : normalized;
};
async function performImport(c: pg.PoolClient, rows: Array<Record<string, unknown>>) {
  const codes = new Set<string>();
  for (const row of rows) {
    const code = String(row.codigoInterno ?? "");
    if (code) {
      if (codes.has(code))
        throw new AppError(409, "import_duplicate_code", "Duplicate explicit code in import");
      codes.add(code);
    }
  }
  let created = 0,
    updated = 0;
  for (const row of rows) {
    const code = String(row.codigoInterno ?? "");
    if (code) {
      const old = await c.query(
        "select id from public.articulos where codigo_interno=$1 for update",
        [code],
      );
      if (old.rows[0]) {
        await c.query("update public.articulos set nombre=$2,categoria=$3,unidad=$4 where id=$1", [
          old.rows[0].id,
          row.nombre,
          row.categoria,
          row.unidad,
        ]);
        updated++;
      } else {
        await c.query(
          "insert into public.articulos(codigo_interno,nombre,categoria,unidad,activo) values($1,$2,$3,$4,true)",
          [code, row.nombre, row.categoria, row.unidad],
        );
        created++;
      }
    } else {
      await c.query(
        "insert into public.articulos(codigo_interno,nombre,categoria,unidad,activo) values(null,$1,$2,$3,true)",
        [row.nombre, row.categoria, row.unidad],
      );
      created++;
    }
  }
  return { creados: created, actualizados: updated };
}
async function performPriceList(
  c: pg.PoolClient,
  input: { proveedorId: string; archivoOrigen: string; rows: Array<Record<string, unknown>> },
) {
  const supplier = await c.query("select id from public.proveedores where id=$1 for update", [
    input.proveedorId,
  ]);
  if (!supplier.rows[0]) throw notFound("Supplier not found");
  const relationRows = (
    await c.query(
      "select id,codigo_proveedor from public.articulos_proveedor where proveedor_id=$1 for update",
      [input.proveedorId],
    )
  ).rows;
  const pendingRows = (
    await c.query(
      "select id,codigo_proveedor,nombre_proveedor from public.articulos_proveedor_pendientes where proveedor_id=$1 and resuelto=false for update",
      [input.proveedorId],
    )
  ).rows;
  const articleRows = (await c.query("select id,codigo_interno from public.articulos")).rows;
  const relations = new Map(
    relationRows.flatMap((r) =>
      r.codigo_proveedor ? [[normalizeSupplierCode(String(r.codigo_proveedor)), String(r.id)]] : [],
    ),
  );
  const pendingByCode = new Map(
    pendingRows.flatMap((r) =>
      r.codigo_proveedor ? [[normalizeSupplierCode(String(r.codigo_proveedor)), String(r.id)]] : [],
    ),
  );
  const pendingByName = new Map(
    pendingRows.flatMap((r) =>
      r.nombre_proveedor ? [[String(r.nombre_proveedor).trim().toLowerCase(), String(r.id)]] : [],
    ),
  );
  const articles = new Map(articleRows.map((r) => [String(r.codigo_interno), String(r.id)]));
  const coded = new Map<string, Record<string, unknown>>(),
    uncoded: Array<Record<string, unknown>> = [];
  for (const row of input.rows) {
    const code = String(row.codigoProveedor || row.codigoInterno || "").trim();
    if (code) coded.set(normalizeSupplierCode(code), row);
    else uncoded.push(row);
  }
  const rows = [...coded.values(), ...uncoded];
  let actualizados = 0,
    vinculados = 0,
    pendientesNuevas = 0,
    pendientesActualizadas = 0;
  for (const row of rows) {
    const code = String(row.codigoProveedor || row.codigoInterno || "").trim(),
      normalized = code ? normalizeSupplierCode(code) : "",
      internal = String(row.codigoInterno ?? "").trim(),
      articleId = internal ? articles.get(internal) : undefined,
      relationId = normalized ? relations.get(normalized) : undefined,
      name = String(row.nombreProveedor ?? "").trim();
    if ((!internal && relationId) || (internal && articleId && relationId)) {
      await c.query(
        "update public.articulos_proveedor set articulo_id=coalesce($2,articulo_id),precio=$3,nombre_proveedor=$4,fecha_actualizacion=now() where id=$1",
        [relationId, articleId ?? null, row.precio, name || null],
      );
      actualizados++;
      if (normalized && pendingByCode.has(normalized))
        await c.query(
          "update public.articulos_proveedor_pendientes set resuelto=true where id=$1",
          [pendingByCode.get(normalized)],
        );
      continue;
    }
    if (internal && articleId) {
      await c.query(
        "insert into public.articulos_proveedor(articulo_id,proveedor_id,codigo_proveedor,nombre_proveedor,precio,activo,fecha_actualizacion) values($1,$2,$3,$4,$5,true,now())",
        [articleId, input.proveedorId, code || null, name || null, row.precio],
      );
      vinculados++;
      if (normalized && pendingByCode.has(normalized))
        await c.query(
          "update public.articulos_proveedor_pendientes set resuelto=true where id=$1",
          [pendingByCode.get(normalized)],
        );
      continue;
    }
    const pendingId = normalized
      ? pendingByCode.get(normalized)
      : pendingByName.get(name.toLowerCase());
    const motivo = internal
      ? `código interno indicado no encontrado: ${internal}`
      : !code
        ? "codigo_proveedor vacío en el archivo (y sin codigo_interno para usar en su lugar)"
        : null;
    const suggestions = name
      ? (
          await c.query("select * from public.buscar_articulos_similares($1,$2)", [
            input.proveedorId,
            name,
          ])
        ).rows
      : null;
    if (pendingId) {
      await c.query(
        "update public.articulos_proveedor_pendientes set codigo_proveedor=$2,nombre_proveedor=$3,precio=$4,archivo_origen=$5,motivo=$6,sugerencias=$7 where id=$1",
        [
          pendingId,
          code || null,
          name || null,
          row.precio,
          input.archivoOrigen,
          motivo,
          suggestions,
        ],
      );
      pendientesActualizadas++;
    } else {
      await c.query(
        "insert into public.articulos_proveedor_pendientes(proveedor_id,codigo_proveedor,nombre_proveedor,precio,archivo_origen,motivo,sugerencias) values($1,$2,$3,$4,$5,$6,$7)",
        [
          input.proveedorId,
          code || null,
          name || null,
          row.precio,
          input.archivoOrigen,
          motivo,
          suggestions,
        ],
      );
      pendientesNuevas++;
    }
  }
  return {
    actualizados,
    vinculadosPorCodigoInterno: vinculados,
    pendientesNuevas,
    pendientesActualizadas,
  };
}
export function createCatalogRepository(db: Db) {
  const one = async (q: string, p: unknown[], message: string) => {
    try {
      const r = await db.query(q, p);
      if (!r.rows[0]) throw notFound(message);
      return r.rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw conflict("Catalog record conflicts with an existing unique value");
      throw error;
    }
  };
  const patch = async (
    table: string,
    id: string,
    input: Record<string, unknown>,
    message: string,
  ) => {
    const a = Object.entries(input).filter(([, v]) => v !== undefined);
    if (!a.length) throw new AppError(400, "invalid_payload", "No fields to update");
    return one(
      `update public.${table} set ${a.map(([k], i) => `${s(k)}=$${i + 2}`).join(",")} where id=$1 returning *`,
      [id, ...a.map(([, v]) => v)],
      message,
    );
  };
  return {
    listSuppliers: () =>
      db.query("select * from public.proveedores order by razon_social,id").then((r) => r.rows),
    supplier: (id: string) =>
      one("select * from public.proveedores where id=$1", [id], "Supplier not found"),
    supplierArticles: (id: string) =>
      db
        .query(
          `select ap.codigo_proveedor,ap.nombre_proveedor,ap.precio,a.codigo_interno
from public.articulos_proveedor ap join public.articulos a on a.id=ap.articulo_id
where ap.proveedor_id=$1 order by ap.codigo_proveedor nulls last,ap.id`,
          [id],
        )
        .then((r) => r.rows),
    createSupplier: (i: Record<string, unknown>) =>
      one(
        "insert into public.proveedores(razon_social,cuit,domicilio,telefono,provincia,condicion_pago_default,activo) values($1,$2,$3,$4,$5,$6,true) returning *",
        [i.razonSocial, i.cuit, i.domicilio, i.telefono, i.provincia, i.condicionPagoDefault],
        "Supplier create failed",
      ),
    updateSupplier: (id: string, i: Record<string, unknown>) =>
      patch("proveedores", id, i, "Supplier not found"),
    supplierStatus: (id: string, activo: boolean) =>
      one(
        "update public.proveedores set activo=$2 where id=$1 returning *",
        [id, activo],
        "Supplier not found",
      ),
    listArticles: () =>
      db.query("select * from public.articulos order by nombre,id").then((r) => r.rows),
    article: (id: string) =>
      one("select * from public.articulos where id=$1", [id], "Article not found"),
    createArticle: (i: Record<string, unknown>) =>
      one(
        "insert into public.articulos(codigo_interno,nombre,categoria,unidad,proveedor_habitual_id,activo) values($1,$2,$3,$4,$5,true) returning *",
        [i.codigoInterno ?? null, i.nombre, i.categoria, i.unidad, i.proveedorHabitualId ?? null],
        "Article create failed",
      ),
    updateArticle: (id: string, i: Record<string, unknown>) =>
      patch("articulos", id, i, "Article not found"),
    articleStatus: (id: string, activo: boolean) =>
      one(
        "update public.articulos set activo=$2 where id=$1 returning *",
        [id, activo],
        "Article not found",
      ),
    relations: (id: string) =>
      db
        .query(
          "select ap.*,p.razon_social from public.articulos_proveedor ap join public.proveedores p on p.id=ap.proveedor_id where ap.articulo_id=$1 order by p.razon_social,ap.id",
          [id],
        )
        .then((r) => r.rows),
    pending: () =>
      db
        .query(
          "select pp.*,p.razon_social from public.articulos_proveedor_pendientes pp join public.proveedores p on p.id=pp.proveedor_id where pp.resuelto=false order by pp.created_at desc,pp.id",
        )
        .then((r) => r.rows),
    async previewArticleImport(rows: Array<Record<string, unknown>>) {
      const explicit = rows.map((r) => String(r.codigoInterno ?? "")).filter(Boolean);
      const counts = new Map<string, number>();
      explicit.forEach((code) => counts.set(code, (counts.get(code) ?? 0) + 1));
      const duplicates = [...counts].filter(([, count]) => count > 1).map(([code]) => code);
      const existing = explicit.length
        ? (
            await db.query(
              "select codigo_interno from public.articulos where codigo_interno=any($1::text[])",
              [explicit],
            )
          ).rows.map((r) => String(r.codigo_interno))
        : [];
      const existingSet = new Set(existing);
      const errors = rows
        .filter((r) => !String(r.nombre ?? "").trim())
        .map((r) => ({ fila: r.fila, motivo: "nombre vacío" }));
      duplicates.forEach((code) =>
        errors.push({ fila: 0, motivo: `código explícito duplicado: ${code}` }),
      );
      return {
        total: rows.length,
        validas: rows.length - errors.length,
        invalidas: errors.length,
        nuevos: rows.filter(
          (r) => !String(r.codigoInterno ?? "") || !existingSet.has(String(r.codigoInterno)),
        ).length,
        actualizaciones: rows.filter((r) => existingSet.has(String(r.codigoInterno ?? ""))).length,
        duplicados: duplicates,
        conflictos: duplicates.length,
        errores: errors,
      };
    },
    async previewPriceList(input: {
      proveedorId: string;
      archivoOrigen: string;
      rows: Array<Record<string, unknown>>;
    }) {
      await this.supplier(input.proveedorId);
      const [relations, pending, articles] = await Promise.all([
        db.query(
          "select id,codigo_proveedor from public.articulos_proveedor where proveedor_id=$1",
          [input.proveedorId],
        ),
        db.query(
          "select id,codigo_proveedor,nombre_proveedor from public.articulos_proveedor_pendientes where proveedor_id=$1 and resuelto=false",
          [input.proveedorId],
        ),
        db.query("select codigo_interno from public.articulos"),
      ]);
      const relationCodes = new Set(
        relations.rows.flatMap((r) =>
          r.codigo_proveedor ? [normalizeSupplierCode(String(r.codigo_proveedor))] : [],
        ),
      );
      const pendingCodes = new Set(
        pending.rows.flatMap((r) =>
          r.codigo_proveedor ? [normalizeSupplierCode(String(r.codigo_proveedor))] : [],
        ),
      );
      const internalCodes = new Set(articles.rows.map((r) => String(r.codigo_interno)));
      const seen = new Set<string>(),
        duplicates = new Set<string>();
      let existingMatches = 0,
        newRelations = 0,
        newPending = 0,
        updatedPending = 0;
      const errors: Array<{ fila: unknown; motivo: string }> = [];
      for (const row of input.rows) {
        const supplierCode = String(row.codigoProveedor ?? "");
        const internal = String(row.codigoInterno ?? "");
        const normalized = supplierCode ? normalizeSupplierCode(supplierCode) : "";
        if (normalized && seen.has(normalized)) duplicates.add(supplierCode);
        if (normalized) seen.add(normalized);
        if (typeof row.precio !== "number" || Number(row.precio) < 0)
          errors.push({ fila: row.fila, motivo: "precio inválido" });
        if (normalized && relationCodes.has(normalized)) existingMatches++;
        else if (internal && internalCodes.has(internal)) newRelations++;
        else if (normalized && pendingCodes.has(normalized)) updatedPending++;
        else newPending++;
      }
      return {
        proveedorId: input.proveedorId,
        total: input.rows.length,
        validas: input.rows.length - errors.length,
        invalidas: errors.length,
        matchesExistentes: existingMatches,
        relacionesNuevas: newRelations,
        pendientesNuevas: newPending,
        pendientesActualizadas: updatedPending,
        duplicados: [...duplicates],
        errores: errors,
      };
    },
    async resolvePending(pendingId: string, articleId: string) {
      const c = await db.pool.connect();
      try {
        await c.query("begin");
        const p = (
          await c.query(
            "select * from public.articulos_proveedor_pendientes where id=$1 and resuelto=false for update",
            [pendingId],
          )
        ).rows[0];
        if (!p) throw notFound("Pending supplier article not found");
        const article = (await c.query("select id from public.articulos where id=$1", [articleId]))
          .rows[0];
        if (!article) throw notFound("Article not found");
        const relation = (
          await c.query(
            `with inserted as (
insert into public.articulos_proveedor(articulo_id,proveedor_id,codigo_proveedor,nombre_proveedor,precio,activo,fecha_actualizacion)
values($1,$2,$3,$4,$5,true,now()) returning *
) select inserted.*,p.razon_social from inserted join public.proveedores p on p.id=inserted.proveedor_id`,
            [article.id, p.proveedor_id, p.codigo_proveedor, p.nombre_proveedor, p.precio],
          )
        ).rows[0];
        await c.query(
          "update public.articulos_proveedor_pendientes set resuelto=true where id=$1",
          [pendingId],
        );
        await c.query("commit");
        return relation;
      } catch (e) {
        await c.query("rollback");
        throw e;
      } finally {
        c.release();
      }
    },
    createRelation: (articleId: string, i: Record<string, unknown>) =>
      one(
        `with inserted as (
insert into public.articulos_proveedor(articulo_id,proveedor_id,codigo_proveedor,nombre_proveedor,precio,activo,fecha_actualizacion)
values($1,$2,$3,$4,$5,coalesce($6,true),now()) returning *
) select inserted.*,p.razon_social from inserted join public.proveedores p on p.id=inserted.proveedor_id`,
        [
          articleId,
          i.proveedorId,
          i.codigoProveedor ?? null,
          i.nombreProveedor,
          i.precio,
          i.activo,
        ],
        "Relation create failed",
      ),
    updateRelation: (articleId: string, id: string, i: Record<string, unknown>) => {
      const a = Object.entries(i).filter(([, v]) => v !== undefined);
      return one(
        `with updated as (
update public.articulos_proveedor set ${a.map(([k], n) => `${s(k)}=$${n + 3}`).join(",")},fecha_actualizacion=now()
where id=$1 and articulo_id=$2 returning *
) select updated.*,p.razon_social from updated join public.proveedores p on p.id=updated.proveedor_id`,
        [id, articleId, ...a.map(([, v]) => v)],
        "Supplier relation not found",
      );
    },
    async executeIdempotent<T extends object>(input: {
      actorId: string;
      operation: "article_import" | "price_list_apply";
      key: string;
      payloadHash: string;
      run: (c: pg.PoolClient) => Promise<T>;
    }) {
      const c = await db.pool.connect();
      try {
        await c.query("begin");
        await c.query(
          `insert into public.catalog_operation_idempotency(actor_id,operation,idempotency_key,payload_hash,status) values($1,$2,$3,$4,'PROCESSING') on conflict do nothing`,
          [input.actorId, input.operation, input.key, input.payloadHash],
        );
        const existing = (
          await c.query(
            "select payload_hash,status,response from public.catalog_operation_idempotency where actor_id=$1 and operation=$2 and idempotency_key=$3 for update",
            [input.actorId, input.operation, input.key],
          )
        ).rows[0] as { payload_hash: string; status: string; response: T | null };
        if (existing.payload_hash !== input.payloadHash)
          throw new AppError(
            409,
            "idempotency_key_payload_mismatch",
            "Idempotency-Key was already used with a different payload",
          );
        if (existing.status === "COMPLETED" && existing.response) {
          await c.query("commit");
          return { replayed: true, response: existing.response };
        }
        const response = await input.run(c);
        await c.query(
          `update public.catalog_operation_idempotency set status='COMPLETED',response=$4,updated_at=now() where actor_id=$1 and operation=$2 and idempotency_key=$3`,
          [input.actorId, input.operation, input.key, JSON.stringify(response)],
        );
        await c.query("commit");
        return { replayed: false, response };
      } catch (e) {
        await c.query("rollback");
        throw e;
      } finally {
        c.release();
      }
    },
    importArticles(
      rows: Array<Record<string, unknown>>,
      idempotency: { actorId: string; key: string; payloadHash: string },
    ) {
      return this.executeIdempotent({
        ...idempotency,
        operation: "article_import",
        run: (c) => performImport(c, rows),
      });
    },
    applyPriceList(
      input: { proveedorId: string; archivoOrigen: string; rows: Array<Record<string, unknown>> },
      idempotency: { actorId: string; key: string; payloadHash: string },
    ) {
      return this.executeIdempotent({
        ...idempotency,
        operation: "price_list_apply",
        run: (c) => performPriceList(c, input),
      });
    },
  };
}
export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
