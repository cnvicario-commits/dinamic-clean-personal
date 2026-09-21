import pg from 'pg'
import type { Env } from '../../config/env.js'
import {
  probePhase2dProfilesCapabilities,
  type Phase2dCapabilityResult,
} from './phase2d-capabilities.js'

const { Pool } = pg

export type Db = {
  pool: pg.Pool
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<pg.QueryResult<T>>
  close: () => Promise<void>
  isReady: () => Promise<boolean>
  /** Read-only Phase 2D perfiles capability probe (no writes). */
  checkPhase2dProfilesCapabilities: () => Promise<Phase2dCapabilityResult>
}

export function createDb(env: Env): Db {
  const needsSsl = /supabase\.co|pooler\.supabase/i.test(env.DATABASE_URL)
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    ssl: needsSsl
      ? { rejectUnauthorized: env.NODE_ENV === 'production' }
      : undefined,
  })

  async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) {
    return pool.query<T>(text, params)
  }

  return {
    pool,
    query,
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
    async checkPhase2dProfilesCapabilities() {
      return probePhase2dProfilesCapabilities(query)
    },
  }
}
