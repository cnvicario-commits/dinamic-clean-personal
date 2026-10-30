import type pg from 'pg'
import type { Db } from '../pool.js'
import { notFound } from '../../../http/errors/app-error.js'
import { rethrowPostgresError } from '../postgres-error.js'

export async function purchaseTransaction<T>(
  db: Db,
  run: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await db.pool.connect()
  try {
    await c.query('begin')
    const result = await run(c)
    await c.query('commit')
    return result
  } catch (error) {
    await c.query('rollback')
    rethrowPostgresError(error)
  } finally {
    c.release()
  }
}

export function purchaseFirst<T extends pg.QueryResultRow>(rows: T[], message: string): T {
  if (!rows[0]) throw notFound(message)
  return rows[0]
}
