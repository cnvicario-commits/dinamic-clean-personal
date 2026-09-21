/**
 * Opt-in Supabase Auth Admin + profiles integration (Dinamic Clean TEST only).
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1
 *   SUPABASE_TEST_PROJECT=1
 *   NODE_ENV=test (or suite forces abort otherwise)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL pointing at TEST
 *
 * Never logs SERVICE_ROLE_KEY, passwords, or tokens.
 *
 * If skipped:
 *   SUPABASE_INTEGRATION_NOT_EXECUTED
 *   REQUIRED GATE: PHASE 2D
 *
 * In-memory fakes are NOT equivalent.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createIdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'

function assertSafeTestEnvironment(): void {
  if (process.env.RUN_SUPABASE_INTEGRATION !== '1') {
    throw new Error('Integration writes require RUN_SUPABASE_INTEGRATION=1')
  }
  if (process.env.SUPABASE_TEST_PROJECT !== '1') {
    throw new Error(
      'Refusing writes: set SUPABASE_TEST_PROJECT=1 for the Dinamic Clean TEST project only',
    )
  }
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing writes: NODE_ENV must be test for Supabase integration')
  }

  const url = (process.env.SUPABASE_URL ?? '').toLowerCase()
  if (!url) {
    throw new Error('SUPABASE_URL required')
  }
  const looksProd =
    url.includes('prod') ||
    process.env.DINAMIC_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  const looksTest =
    url.includes('test') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    process.env.SUPABASE_TEST_PROJECT === '1'

  if (looksProd && !url.includes('test')) {
    throw new Error('Refusing integration against a production-looking Supabase URL')
  }
  if (!looksTest && process.env.DINAMIC_ALLOW_NONMARKED_SUPABASE !== '1') {
    throw new Error(
      'Refusing: Supabase URL is not clearly a test/local endpoint. Mark TEST project or abort.',
    )
  }
}

describe.skipIf(!enabled)('Supabase identity adapters (opt-in RUN_SUPABASE_INTEGRATION=1)', () => {
  const createdIds: string[] = []
  let identity: ReturnType<typeof createIdentityAdmin>
  let profiles: ReturnType<typeof createProfilesRepository>
  let db: ReturnType<typeof createDb>
  let syntheticEmail: string

  beforeAll(() => {
    assertSafeTestEnvironment()
    const env = loadEnv()
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('RUN_SUPABASE_INTEGRATION=1 requires SUPABASE_SERVICE_ROLE_KEY')
    }
    db = createDb(env)
    identity = createIdentityAdmin(env)
    profiles = createProfilesRepository(env, db)
    syntheticEmail = `phase2b.integration.${Date.now()}.${crypto.randomUUID().slice(0, 8)}@example.invalid`
  })

  afterAll(async () => {
    for (const id of [...createdIds]) {
      try {
        await identity.deleteAuthUser(id)
      } catch {
        // best-effort cleanup — never log secrets
      }
    }
    if (db) await db.close()
  })

  it('Auth Admin create → profile upsert → read → update name → change role → set password → cleanup', async () => {
    assertSafeTestEnvironment()
    const password = `Tmp-${crypto.randomUUID()}`
    let authId: string | undefined
    try {
      const auth = await identity.createAuthUser({
        email: syntheticEmail,
        password,
      })
      authId = auth.id
      createdIds.push(auth.id)
      expect(auth.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )

      const upserted = await profiles.upsert({
        id: auth.id,
        nombreCompleto: 'Integration Synthetic',
        rol: 'compras',
      })
      expect(upserted.id).toBe(auth.id)
      expect(upserted.rol).toBe('compras')

      const read = await profiles.getById(auth.id)
      expect(read?.nombre_completo).toBe('Integration Synthetic')

      const renamed = await profiles.updateNombreCompleto(auth.id, 'Integration Renamed')
      expect(renamed.nombre_completo).toBe('Integration Renamed')

      const roleChanged = await profiles.updateRole(auth.id, 'supervisor')
      expect(roleChanged.rol).toBe('supervisor')

      await identity.setAuthPassword(auth.id, `Tmp-${crypto.randomUUID()}`)

      const emails = await identity.listAuthEmails()
      expect(emails.has(auth.id)).toBe(true)
    } finally {
      if (authId) {
        try {
          await identity.deleteAuthUser(authId)
          const idx = createdIds.indexOf(authId)
          if (idx >= 0) createdIds.splice(idx, 1)
        } catch {
          // afterAll will retry
        }
      }
    }
  })
})

describe('Supabase integration gate documentation', () => {
  it('records SUPABASE_INTEGRATION_NOT_EXECUTED when opt-in suite is disabled', () => {
    if (enabled) {
      expect(process.env.SUPABASE_TEST_PROJECT).toBe('1')
      return
    }
    // Explicit marker — fakes are NOT equivalent.
    expect('SUPABASE_INTEGRATION_NOT_EXECUTED').toBeTruthy()
    expect(process.env.RUN_SUPABASE_INTEGRATION ?? '').not.toBe('1')
  })
})
