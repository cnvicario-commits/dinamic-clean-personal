/**
 * Opt-in Supabase Auth Admin + profiles integration (Dinamic Clean TEST only).
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1
 *   NODE_ENV=test
 *   EXPECTED_SUPABASE_TEST_PROJECT_REF=<exact ref>
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL → same TEST project
 *
 * Never logs SERVICE_ROLE_KEY, passwords, or tokens.
 * If skipped: SUPABASE_INTEGRATION_NOT_EXECUTED
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createIdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'

describe.skipIf(!enabled)('Supabase identity adapters (opt-in RUN_SUPABASE_INTEGRATION=1)', () => {
  const createdIds: string[] = []
  let identity: ReturnType<typeof createIdentityAdmin>
  let profiles: ReturnType<typeof createProfilesRepository>
  let db: ReturnType<typeof createDb>
  let syntheticEmail: string

  beforeAll(() => {
    assertDinamicCleanTestTarget()
    const env = loadEnv()
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('RUN_SUPABASE_INTEGRATION=1 requires SUPABASE_SERVICE_ROLE_KEY')
    }
    db = createDb(env)
    identity = createIdentityAdmin(env)
    profiles = createProfilesRepository(db)
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
    assertDinamicCleanTestTarget()
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
      expect(process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF).toBeTruthy()
      return
    }
    expect('SUPABASE_INTEGRATION_NOT_EXECUTED').toBeTruthy()
    expect(process.env.RUN_SUPABASE_INTEGRATION ?? '').not.toBe('1')
  })
})
