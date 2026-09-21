/**
 * Opt-in: demotion UPDATE must roll back with the advisory-lock transaction.
 *
 * RUN_SUPABASE_INTEGRATION=1 NODE_ENV=test EXPECTED_SUPABASE_TEST_PROJECT_REF=...
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createIdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'
import { AppError } from '../src/http/errors/app-error.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'

describe.skipIf(!enabled)('Phase 2E demotion rollback (same TX as lock)', () => {
  const createdIds: string[] = []
  let identity: ReturnType<typeof createIdentityAdmin>
  let profiles: ReturnType<typeof createProfilesRepository>
  let db: ReturnType<typeof createDb>
  let adminKeep: string
  let adminTarget: string

  beforeAll(async () => {
    assertDinamicCleanTestTarget()
    const env = loadEnv()
    if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('requires SUPABASE_SERVICE_ROLE_KEY')
    db = createDb(env)
    identity = createIdentityAdmin(env)
    profiles = createProfilesRepository(db)

    const mk = async (label: string) => {
      const email = `phase2e.rollback.${label}.${Date.now()}.${crypto.randomUUID().slice(0, 6)}@example.invalid`
      const u = await identity.createAuthUser({
        email,
        password: `T3st-${crypto.randomUUID().slice(0, 12)}`,
      })
      createdIds.push(u.id)
      await profiles.upsert({ id: u.id, nombreCompleto: label, rol: 'admin' })
      return u.id
    }
    adminKeep = await mk('Keep')
    adminTarget = await mk('Target')
  })

  afterAll(async () => {
    for (const id of [...createdIds]) {
      try {
        await identity.deleteAuthUser(id)
      } catch {
        // best-effort
      }
    }
    if (db) await db.close()
  })

  it('UPDATE inside lock then forced error → ROLLBACK leaves rol=admin', async () => {
    await expect(
      profiles.withAdminLifecycleLock(async ({ tx }) => {
        const updated = await tx.updateRole(adminTarget, 'compras')
        expect(updated.rol).toBe('compras')
        throw new AppError(500, 'forced_rollback', 'intentional test rollback')
      }),
    ).rejects.toMatchObject({ code: 'forced_rollback' })

    const row = await profiles.getById(adminTarget)
    expect(row?.rol).toBe('admin')
    // keep still admin
    expect((await profiles.getById(adminKeep))?.rol).toBe('admin')
  })
})

if (!enabled) {
  console.info('SUPABASE_INTEGRATION_NOT_EXECUTED phase2e-demotion-rollback')
}
