/**
 * Opt-in concurrency test for last-active-admin invariant (pg_advisory_xact_lock).
 *
 * Requires real DATABASE_URL + Auth Admin on TEST project:
 *   RUN_SUPABASE_INTEGRATION=1 NODE_ENV=test EXPECTED_SUPABASE_TEST_PROJECT_REF=...
 *
 * Spawns two parallel disable/demote operations; exactly one may succeed when only
 * two ACTIVE admins exist (final ACTIVE admin count >= 1).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createIdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { disableUser, changeUserRole } from '../src/application/users/users-service.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'
import { AppError } from '../src/http/errors/app-error.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'

describe.skipIf(!enabled)('Phase 2E last-admin concurrency (opt-in)', () => {
  const createdIds: string[] = []
  let identity: ReturnType<typeof createIdentityAdmin>
  let profiles: ReturnType<typeof createProfilesRepository>
  let db: ReturnType<typeof createDb>
  let adminA: string
  let adminB: string
  let actor: string

  beforeAll(async () => {
    assertDinamicCleanTestTarget()
    const env = loadEnv()
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('requires SUPABASE_SERVICE_ROLE_KEY')
    }
    db = createDb(env)
    identity = createIdentityAdmin(env)
    profiles = createProfilesRepository(db)

    const mk = async (label: string) => {
      const email = `phase2e.conc.${label}.${Date.now()}.${crypto.randomUUID().slice(0, 6)}@example.invalid`
      const u = await identity.createAuthUser({
        email,
        password: `T3st-${crypto.randomUUID().slice(0, 12)}`,
      })
      createdIds.push(u.id)
      await profiles.upsert({ id: u.id, nombreCompleto: label, rol: 'admin' })
      return u.id
    }
    adminA = await mk('A')
    adminB = await mk('B')
    actor = await mk('Actor')
  })

  afterAll(async () => {
    for (const id of [...createdIds]) {
      try {
        await identity.unbanAuthUser(id).catch(() => undefined)
        await identity.deleteAuthUser(id)
      } catch {
        // best-effort
      }
    }
    if (db) await db.close()
  })

  async function countActiveAdmins(): Promise<number> {
    let all = 0
    for (const r of await profiles.list()) {
      if (r.rol !== 'admin') continue
      const st = await identity.getAuthUserSecurityState(r.id)
      if (st.status === 'ACTIVE') all += 1
    }
    return all
  }

  it('concurrent disable A and disable B → >= 1 ACTIVE admin remains', async () => {
    // Ensure A and B active admins
    await identity.unbanAuthUser(adminA).catch(() => undefined)
    await identity.unbanAuthUser(adminB).catch(() => undefined)
    await profiles.updateRole(adminA, 'admin')
    await profiles.updateRole(adminB, 'admin')

    const deps = { identity, profiles }
    const results = await Promise.allSettled([
      disableUser(deps, adminA, { userId: actor }),
      disableUser(deps, adminB, { userId: actor }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length
    const rejectedProtected = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof AppError &&
        r.reason.code === 'last_admin_protected',
    ).length

    expect(fulfilled + rejectedProtected).toBe(2)
    expect(fulfilled).toBeLessThanOrEqual(1)
    expect(await countActiveAdmins()).toBeGreaterThanOrEqual(1)
  })

  it('concurrent demote A and demote B → >= 1 ACTIVE admin remains', async () => {
    await identity.unbanAuthUser(adminA).catch(() => undefined)
    await identity.unbanAuthUser(adminB).catch(() => undefined)
    await profiles.updateRole(adminA, 'admin')
    await profiles.updateRole(adminB, 'admin')

    const deps = { identity, profiles }
    const results = await Promise.allSettled([
      changeUserRole(deps, adminA, 'compras', { actorUserId: actor }),
      changeUserRole(deps, adminB, 'compras', { actorUserId: actor }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length
    expect(fulfilled).toBeLessThanOrEqual(1)
    expect(await countActiveAdmins()).toBeGreaterThanOrEqual(1)
  })
})

if (!enabled) {
  console.info('SUPABASE_INTEGRATION_NOT_EXECUTED phase2e-last-admin-concurrency')
}
