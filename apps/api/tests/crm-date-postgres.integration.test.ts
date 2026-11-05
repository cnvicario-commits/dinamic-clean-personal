/**
 * Read-only check that CRM date parsing matches PostgreSQL's calendar date.
 *
 *   RUN_SUPABASE_INTEGRATION=1 NODE_ENV=test DB_COMPATIBILITY_TARGET=simulation
 *   DATABASE_URL → loopback only
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { withCrmCalendarDates } from '../src/infrastructure/db/crm/crm-dates.js'
import type { Db } from '../src/infrastructure/db/pool.js'
import { crmUpdateOpportunity } from '../src/http/schemas/crm.js'
import { assertDinamicCleanTestTarget, isSupabaseIntegrationEnabled } from './supabase-test-guard.js'

const SQL = `select '2026-08-30'::date as fecha_envio, '2026-09-01'::date as fecha_facturacion, timestamptz '2026-10-14 21:39:00.123+00' as updated_at`

describe.skipIf(!isSupabaseIntegrationEnabled())('CRM PostgreSQL date columns', () => {
  let raw: Db
  let crm: Db

  beforeAll(async () => {
    assertDinamicCleanTestTarget()
    const url = process.env.DATABASE_URL!
    const pool = new pg.Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      ssl: /supabase\.co|pooler\.supabase/i.test(url) ? { rejectUnauthorized: false } : undefined,
    })
    raw = {
      pool,
      query: (text, params) => pool.query(text, params),
      close: () => pool.end(),
      async isReady() {
        return true
      },
      async checkPhase2dProfilesCapabilities() {
        throw new Error('unused')
      },
      async checkPhase3aCapabilities() {
        throw new Error('unused')
      },
    }
    crm = withCrmCalendarDates(raw)
  })

  afterAll(async () => {
    await raw?.close()
  })

  it('returns YYYY-MM-DD from OID 1082 on the CRM checkout and keeps timestamptz as a Date', async () => {
    const before = await raw.query<{ fecha_envio: unknown; updated_at: unknown }>(SQL)
    expect(before.rows[0]?.fecha_envio).toBeInstanceOf(Date)
    expect(before.rows[0]?.updated_at).toBeInstanceOf(Date)

    const scoped = await crm.query<{ fecha_envio: unknown; fecha_facturacion: unknown; updated_at: unknown }>(SQL)
    expect(scoped.rows[0]?.fecha_envio).toBe('2026-08-30')
    expect(scoped.rows[0]?.fecha_facturacion).toBe('2026-09-01')
    expect(scoped.rows[0]?.updated_at).toBeInstanceOf(Date)

    const after = await raw.query<{ fecha_envio: unknown }>(SQL)
    expect(after.rows[0]?.fecha_envio).toBeInstanceOf(Date)

    const apiRow = JSON.parse(JSON.stringify(scoped.rows[0])) as {
      fecha_envio: string
      fecha_facturacion: string
      updated_at: string
    }
    expect(crmUpdateOpportunity.safeParse({
      updatedAt: apiRow.updated_at,
      fechaEnvio: apiRow.fecha_envio,
      fechaFacturacion: apiRow.fecha_facturacion,
      comentarios: 'nuevo',
    }).success).toBe(true)
  })
})
