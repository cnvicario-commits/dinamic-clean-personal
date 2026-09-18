import pg from 'pg'
import type { Env } from '../../config/env.js'

const { Pool } = pg

export type Db = {
  pool: pg.Pool
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<pg.QueryResult<T>>
  close: () => Promise<void>
  isReady: () => Promise<boolean>
}

export function createDb(env: Env): Db {
  const needsSsl = /supabase\.co|pooler\.supabase/i.test(env.DATABASE_URL)
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    // Supabase pooler requires TLS; rejectUnauthorized relaxed in non-prod only.
    ssl: needsSsl
      ? { rejectUnauthorized: env.NODE_ENV === 'production' }
      : undefined,
  })

  return {
    pool,
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
      return pool.query<T>(text, params)
    },
    async close() {
      await pool.end()
    },
    async isReady() {
      const client = await pool.connect()
      try {
        await client.query('select 1')
        return true
      } finally {
        client.release()
      }
    },
  }
}
