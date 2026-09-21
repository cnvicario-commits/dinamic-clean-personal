/**
 * Opt-in concurrency test: exactly two ACTIVE admins A and B (no third actor admin).
 *
 * Cross operations (A disables B || B disables A) — self-disable is forbidden.
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1 NODE_ENV=test EXPECTED_SUPABASE_TEST_PROJECT_REF=...
 *
 * Suite aborts if other ACTIVE admins exist (TEST_ENV_NOT_ISOLATED_FOR_LAST_ADMIN_CONCURRENCY).
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

describe.skipIf(!enabled)('Phase 2E last-admin concurrency (exactly two admins)', () => {
  const createdIds: string[] = []
  /** ACTIVE admins temporarily banned so the suite has exactly A+B. Restored in afterAll. */
  const bannedForIsolation: string[] = []
  let identity: ReturnType<typeof createIdentityAdmin>
  let profiles: ReturnType<typeof createProfilesRepository>
  let db: ReturnType<typeof createDb>
  let adminA: string
  let adminB: string

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

    // Force exactly-two ACTIVE admins: temporarily ban every other ACTIVE admin in TEST.
    // Restored in afterAll. If any remain ACTIVE after ban attempts → hard fail (no weak asserts).
    await isolateExactlyTwoActiveAdmins()

    const otherActiveAdminCount = await countOtherActiveAdmins()
    if (otherActiveAdminCount !== 0) {
      throw new Error(
        `TEST_ENV_NOT_ISOLATED_FOR_LAST_ADMIN_CONCURRENCY (otherActiveAdminCount=${otherActiveAdminCount})`,
      )
    }
  }, 120_000)

  afterAll(async () => {
    for (const id of bannedForIsolation) {
      try {
        await identity.unbanAuthUser(id)
      } catch {
        // best-effort restore
      }
    }
    for (const id of [...createdIds]) {
      try {
        await identity.unbanAuthUser(id).catch(() => undefined)
        await identity.deleteAuthUser(id)
      } catch {
        // best-effort
      }
    }
    if (db) await db.close()
  }, 120_000)

  async function isolateExactlyTwoActiveAdmins(): Promise<void> {
    const states = await identity.listAuthUserSecurityStates()
    for (const r of await profiles.list()) {
      if (r.rol !== 'admin') continue
      if (r.id === adminA || r.id === adminB) continue
      if (states.get(r.id)?.status !== 'ACTIVE') continue
      await identity.banAuthUser(r.id)
      bannedForIsolation.push(r.id)
    }
  }

  async function countOtherActiveAdmins(): Promise<number> {
    const states = await identity.listAuthUserSecurityStates()
    const adminRows = (await profiles.list()).filter((r) => r.rol === 'admin')
    let n = 0
    for (const r of adminRows) {
      if (r.id === adminA || r.id === adminB) continue
      if (states.get(r.id)?.status === 'ACTIVE') n += 1
    }
    return n
  }

  async function resetPairAsActiveAdmins() {
    await identity.unbanAuthUser(adminA).catch(() => undefined)
    await identity.unbanAuthUser(adminB).catch(() => undefined)
    await profiles.updateRole(adminA, 'admin')
    await profiles.updateRole(adminB, 'admin')
  }

  async function countGlobalActiveAdmins(): Promise<number> {
    const states = await identity.listAuthUserSecurityStates()
    let n = 0
    for (const r of await profiles.list()) {
      if (r.rol !== 'admin') continue
      if (states.get(r.id)?.status === 'ACTIVE') n += 1
    }
    return n
  }

  function summarize(results: PromiseSettledResult<unknown>[]) {
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length
    const protectedRejects = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof AppError &&
        r.reason.code === 'last_admin_protected',
    ).length
    return { fulfilled, protectedRejects }
  }

  function assertIsolatedRace(results: PromiseSettledResult<unknown>[]) {
    const { fulfilled, protectedRejects } = summarize(results)
    expect(fulfilled).toBe(1)
    expect(protectedRejects).toBe(1)
  }

  it(
    'disable A || disable B (cross): ACTIVE_ADMIN_COUNT >= 1',
    async () => {
      await resetPairAsActiveAdmins()
      const deps = { identity, profiles }
      const results = await Promise.allSettled([
        disableUser(deps, adminB, { userId: adminA }),
        disableUser(deps, adminA, { userId: adminB }),
      ])
      assertIsolatedRace(results)
      expect(await countGlobalActiveAdmins()).toBeGreaterThanOrEqual(1)
    },
    90_000,
  )

  it(
    'demote A || demote B: ACTIVE_ADMIN_COUNT >= 1',
    async () => {
      await resetPairAsActiveAdmins()
      const deps = { identity, profiles }
      const results = await Promise.allSettled([
        changeUserRole(deps, adminB, 'compras', { actorUserId: adminA }),
        changeUserRole(deps, adminA, 'compras', { actorUserId: adminB }),
      ])
      assertIsolatedRace(results)
      expect(await countGlobalActiveAdmins()).toBeGreaterThanOrEqual(1)
    },
    90_000,
  )

  it(
    'disable A || demote B: ACTIVE_ADMIN_COUNT >= 1',
    async () => {
      await resetPairAsActiveAdmins()
      const deps = { identity, profiles }
      const results = await Promise.allSettled([
        disableUser(deps, adminA, { userId: adminB }),
        changeUserRole(deps, adminB, 'compras', { actorUserId: adminA }),
      ])
      assertIsolatedRace(results)
      expect(await countGlobalActiveAdmins()).toBeGreaterThanOrEqual(1)
    },
    90_000,
  )
})

if (!enabled) {
  console.info('SUPABASE_INTEGRATION_NOT_EXECUTED phase2e-last-admin-concurrency')
}
