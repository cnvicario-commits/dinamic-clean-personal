import { createHash } from "node:crypto";
import type pg from "pg";
import type { Db } from "./pool.js";
import { AppError, badRequest, notFound } from "../../http/errors/app-error.js";
import type { ResultsImport } from "../../http/schemas/results.js";

const fields = [
  "id",
  "anio",
  "mes",
  "ventas_dinamic",
  "ventas_moral",
  "total_ventas",
  "total_costos_directos",
  "resultado_bruto",
  "total_rrhh",
  "total_estructura_servicios",
  "total_honorarios_abonos",
  "total_gastos_financieros",
  "total_gastos_comerciales",
  "total_otros_gastos",
  "total_impuestos",
  "resultado_periodo",
  "created_at",
  "updated_at",
].join(",");
const columns = [
  "ventas_dinamic",
  "ventas_moral",
  "total_ventas",
  "total_costos_directos",
  "resultado_bruto",
  "total_rrhh",
  "total_estructura_servicios",
  "total_honorarios_abonos",
  "total_gastos_financieros",
  "total_gastos_comerciales",
  "total_otros_gastos",
  "total_impuestos",
  "resultado_periodo",
] as const;
type ImportRow = ResultsImport["rows"][number];
function transaction<T>(db: Db, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  return (async () => {
    const c = await db.pool.connect();
    try {
      await c.query("begin");
      const v = await fn(c);
      await c.query("commit");
      return v;
    } catch (e) {
      await c.query("rollback");
      if (e instanceof AppError) throw e;
      throw new AppError(502, "results_persistence_failed", "Results persistence failed");
    } finally {
      c.release();
    }
  })();
}
function validateRow(row: ImportRow) {
  for (const key of Object.keys(row.values))
    if (!(columns as readonly string[]).includes(key))
      throw badRequest(`Unknown result field: ${key}`);
  return row;
}
function duplicatePeriods(rows: ImportRow[]) {
  const seen = new Set<string>(),
    duplicates = new Set<string>();
  for (const row of rows) {
    const p = `${row.anio}-${row.mes}`;
    if (seen.has(p)) duplicates.add(p);
    seen.add(p);
  }
  return [...duplicates];
}
function rejectDuplicatePeriods(rows: ImportRow[]) {
  const duplicates = duplicatePeriods(rows);
  if (duplicates.length)
    throw new AppError(
      409,
      "duplicate_result_period",
      `Duplicate result period(s): ${duplicates.join(", ")}`,
      { duplicates },
    );
}
export function createResultsRepository(db: Db) {
  async function list(filter: { anio?: number | undefined; mes?: number | undefined }) {
    const where: string[] = [];
    const p: unknown[] = [];
    if (filter.anio !== undefined) {
      p.push(filter.anio);
      where.push(`anio=$${p.length}`);
    }
    if (filter.mes !== undefined) {
      p.push(filter.mes);
      where.push(`mes=$${p.length}`);
    }
    return (
      await db.query(
        `select ${fields} from public.resultados_mensuales ${where.length ? `where ${where.join(" and ")}` : ""} order by anio,mes`,
        p,
      )
    ).rows;
  }
  async function detail(id: string) {
    const h = (
      await db.query(`select ${fields} from public.resultados_mensuales where id=$1`, [id])
    ).rows[0];
    if (!h) throw notFound("Result not found");
    const d = await db.query(
      "select id,resultados_mensuales_id,anio,mes,rubro,concepto,monto from public.resultados_mensuales_detalle where resultados_mensuales_id=$1 order by rubro,concepto,id",
      [id],
    );
    return { ...h, details: d.rows };
  }
  async function preview(input: ResultsImport) {
    input.rows.forEach(validateRow);
    const duplicates = duplicatePeriods(input.rows);
    const tuples = input.rows.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(",");
    const existing = await db.query(
      `select anio,mes from public.resultados_mensuales where (anio,mes) in (${tuples})`,
      input.rows.flatMap((r) => [r.anio, r.mes]),
    );
    const set = new Set(existing.rows.map((r) => `${r.anio}-${r.mes}`));
    return {
      total: input.rows.length,
      valid: input.rows.length - duplicates.length,
      invalid: duplicates.length,
      newRows: input.rows.filter((r) => !set.has(`${r.anio}-${r.mes}`)).length,
      updates: input.rows.filter((r) => set.has(`${r.anio}-${r.mes}`)).length,
      duplicates,
      errors: duplicates.map((period) => ({
        period,
        message: "Duplicate period in import payload",
      })),
    };
  }
  async function apply(input: ResultsImport, key: string, actorId: string) {
    input.rows.forEach(validateRow);
    rejectDuplicatePeriods(input.rows);
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return transaction(db, async (c) => {
      const claim = await c.query(
        `insert into public.resultados_import_idempotency(actor_id,idempotency_key,payload_hash,status,response)
values($1,$2,$3,'PROCESSING',null) on conflict(actor_id,idempotency_key) do nothing returning id`,
        [actorId, key, hash],
      );
      if (!claim.rows[0]) {
        const old = (
          await c.query(
            "select payload_hash,status,response from public.resultados_import_idempotency where actor_id=$1 and idempotency_key=$2 for update",
            [actorId, key],
          )
        ).rows[0];
        if (!old || old.payload_hash !== hash)
          throw new AppError(
            409,
            "idempotency_key_payload_mismatch",
            "Idempotency-Key payload mismatch",
          );
        if (old.status === "COMPLETED") return old.response;
      }
      const resultIds: string[] = [],
        createdPeriods: string[] = [],
        updatedPeriods: string[] = [];
      for (const row of input.rows) {
        const period = `${row.anio}-${row.mes}`,
          vals = columns.map((k) => row.values[k] ?? null);
        const h = (
          await c.query(
            `insert into public.resultados_mensuales(anio,mes,${columns.join(",")}) values($1,$2,${columns.map((_, i) => `$${i + 3}`).join(",")})
on conflict(anio,mes) do update set ${columns.map((k) => `${k}=excluded.${k}`).join(",")} returning id,xmax`,
            [row.anio, row.mes, ...vals],
          )
        ).rows[0];
        if (!h) throw new AppError(502, "results_create_failed", "Result persistence failed");
        resultIds.push(String(h.id));
        (String(h.xmax) === "0" ? createdPeriods : updatedPeriods).push(period);
        await c.query(
          "delete from public.resultados_mensuales_detalle where resultados_mensuales_id=$1",
          [h.id],
        );
        for (const d of row.details)
          await c.query(
            "insert into public.resultados_mensuales_detalle(resultados_mensuales_id,anio,mes,rubro,concepto,monto) values($1,$2,$3,$4,$5,$6)",
            [h.id, row.anio, row.mes, d.rubro, d.concepto, d.monto],
          );
      }
      const response = { resultIds, createdPeriods, updatedPeriods };
      await c.query(
        "update public.resultados_import_idempotency set status='COMPLETED',response=$3,updated_at=now() where actor_id=$1 and idempotency_key=$2",
        [actorId, key, response],
      );
      return response;
    });
  }
  return { list, detail, preview, apply };
}
export type ResultsRepository = ReturnType<typeof createResultsRepository>;
