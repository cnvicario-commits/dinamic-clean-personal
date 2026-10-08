import crypto from 'node:crypto'
import type pg from 'pg'
import type { Db } from '../pool.js'
import { conflict, notFound } from '../../../http/errors/app-error.js'

export type AuditClient = pg.PoolClient

export const auditTx = async <T>(db: Db, run: (c: AuditClient) => Promise<T>): Promise<T> => {
  const c = await db.pool.connect()
  try {
    await c.query('begin')
    const result = await run(c)
    await c.query('commit')
    return result
  } catch (error) {
    await c.query('rollback')
    throw error
  } finally {
    c.release()
  }
}

export const auditOne = <T>(rows: T[], message: string): T => {
  if (!rows[0]) throw notFound(message)
  return rows[0]
}

/** Normalize pg Date / HTTP ISO strings so optimistic concurrency compares the same instant. */
export const concurrencyToken = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    return value
  }
  throw conflict('Missing concurrency token')
}

export const assertUnchanged = (current: unknown, expected: unknown, message: string) => {
  if (concurrencyToken(current) !== concurrencyToken(expected)) throw conflict(message)
}

export const auditPayloadHash = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

export const siteJoin = `
  join public.cliente_domicilios d on d.id = a.alias_id
  left join public.clientes cl on cl.id = d.cliente_id
  left join public.perfiles s on s.id = a.supervisor_id
`

export const siteJson = `
  jsonb_build_object(
    'alias', d.alias,
    'direccion', d.direccion,
    'clientes', case when cl.id is null then null else jsonb_build_object('nombre', cl.nombre) end
  ) as cliente_domicilios,
  case when s.id is null then null else jsonb_build_object('nombre_completo', s.nombre_completo) end as perfiles
`

export const auditDateFilter = (desde: string | undefined, hasta: string | undefined, params: unknown[]) => {
  const clauses: string[] = []
  if (desde) {
    params.push(desde)
    clauses.push(`a.fecha_realizada >= $${params.length}`)
  }
  if (hasta) {
    params.push(hasta)
    clauses.push(`a.fecha_realizada <= $${params.length}`)
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : ''
}

export async function beginAuditIdempotency(
  c: AuditClient,
  actor: string,
  operation: 'audit_submit' | 'audit_checklist_copy',
  key: string,
  payloadHash: string,
) {
  await c.query(
    `insert into public.audits_operation_idempotency
      (actor_id, operation, idempotency_key, payload_hash, status)
     values ($1, $2, $3, $4, 'PROCESSING')
     on conflict do nothing`,
    [actor, operation, key, payloadHash],
  )

  const idem = auditOne(
    (
      await c.query<{ payload_hash: string; status: string; response: unknown }>(
        `select payload_hash, status, response
         from public.audits_operation_idempotency
         where actor_id = $1 and operation = $2 and idempotency_key = $3
         for update`,
        [actor, operation, key],
      )
    ).rows,
    'Idempotency unavailable',
  )

  if (idem.payload_hash !== payloadHash) {
    throw conflict('Idempotency-Key was already used with a different payload')
  }

  if (idem.status === 'COMPLETED') {
    return { replayed: true as const, response: idem.response }
  }

  return { replayed: false as const, response: null }
}

export async function completeAuditIdempotency(
  c: AuditClient,
  actor: string,
  operation: 'audit_submit' | 'audit_checklist_copy',
  key: string,
  response: unknown,
) {
  await c.query(
    `update public.audits_operation_idempotency
     set status = 'COMPLETED', response = $4, updated_at = now()
     where actor_id = $1 and operation = $2 and idempotency_key = $3`,
    [actor, operation, key, JSON.stringify(response)],
  )
}
