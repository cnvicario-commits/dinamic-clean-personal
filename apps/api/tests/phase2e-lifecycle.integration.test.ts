/**
 * Opt-in Phase 2E lifecycle + stale token tests (Dinamic Clean TEST only).
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1
 *   NODE_ENV=test
 *   EXPECTED_SUPABASE_TEST_PROJECT_REF=<exact ref>
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SUPABASE_JWT_SECRET → TEST project
 *
 * Never logs secrets/tokens/passwords.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../src/config/env.js'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createIdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'

describe.skipIf(!enabled)('Phase 2E Supabase lifecycle (opt-in)', () => {
  const createdIds: string[] = []
  let env: ReturnType<typeof loadEnv>
  let identity: ReturnType<typeof createIdentityAdmin>
  let profiles: ReturnType<typeof createProfilesRepository>
  let db: ReturnType<typeof createDb>
  let password: string
  let email: string

  beforeAll(() => {
    assertDinamicCleanTestTarget()
    env = loadEnv()
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('RUN_SUPABASE_INTEGRATION=1 requires SUPABASE_SERVICE_ROLE_KEY')
    }
    db = createDb(env)
    identity = createIdentityAdmin(env)
    profiles = createProfilesRepository(db)
    password = `T3st-${crypto.randomUUID().slice(0, 12)}`
    email = `phase2e.lifecycle.${Date.now()}.${crypto.randomUUID().slice(0, 8)}@example.invalid`
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

  it('disable blocks same access token; enable + re-login works', async () => {
    const authUser = await identity.createAuthUser({ email, password })
    createdIds.push(authUser.id)
    await profiles.upsert({
      id: authUser.id,
      nombreCompleto: 'Phase2E Victim',
      rol: 'compras',
    })

    const anon = createClient(env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // Prefer signing in via password grant through gotrue if anon key present;
    // otherwise skip login portion with explicit note.
    if (!process.env.SUPABASE_ANON_KEY) {
      // Still verify Auth Admin ban + backend deny path using a signed HS256 token
      // is not enough for live JWKS — require anon for full CASE.
      expect(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY required for login/token CASE').toBeTruthy()
      return
    }

    const { data: login, error: loginErr } = await anon.auth.signInWithPassword({
      email,
      password,
    })
    expect(loginErr).toBeNull()
    const accessToken = login.session?.access_token
    expect(accessToken).toBeTruthy()

    const app = await buildApp(env, { db, identityAdmin: identity, profilesRepo: profiles })
    await app.ready()
    try {
      const before = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(before.statusCode).toBe(200)

      await identity.banAuthUser(authUser.id)
      await identity.revokeUserSessions(authUser.id).catch(() => undefined)

      const after = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(after.statusCode).toBe(401)
      expect(after.json()).toMatchObject({ code: 'user_disabled' })

      const { error: refreshErr } = await anon.auth.refreshSession()
      // Ban should block refresh; record actual behavior
      expect(refreshErr).toBeTruthy()

      await identity.unbanAuthUser(authUser.id)
      const { data: again, error: againErr } = await anon.auth.signInWithPassword({
        email,
        password,
      })
      expect(againErr).toBeNull()
      const ok = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${again.session?.access_token}` },
      })
      expect(ok.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })
})

if (!enabled) {
  // Visible marker when suite is skipped (evidence hygiene).
  console.info('SUPABASE_INTEGRATION_NOT_EXECUTED phase2e-lifecycle')
}
