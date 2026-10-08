import type pg from "pg";
import { AppError, notFound } from "../../../http/errors/app-error.js";

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
export { performImport, performPriceList, normalizeSupplierCode };
