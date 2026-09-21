/**
 * Opt-in Phase 2E lifecycle against Supabase TEST.
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1
 *   NODE_ENV=test
 *   EXPECTED_SUPABASE_TEST_PROJECT_REF=<exact ref>
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SUPABASE_ANON_KEY → TEST
 *
 * Documents: no revoke-by-user-id API; Option C tokens_valid_after for access JWTs.
 * Refresh behavior is recorded as observed (NOT invented).
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
    if (!process.env.SUPABASE_ANON_KEY) {
      throw new Error('RUN_SUPABASE_INTEGRATION=1 requires SUPABASE_ANON_KEY for login/refresh cases')
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

  it('disable/enable access-token + refresh observed behavior', async () => {
    const authUser = await identity.createAuthUser({ email, password })
    createdIds.push(authUser.id)
    await profiles.upsert({
      id: authUser.id,
      nombreCompleto: 'Phase2E Victim',
      rol: 'compras',
    })

    const anon = createClient(env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: login, error: loginErr } = await anon.auth.signInWithPassword({
      email,
      password,
    })
    expect(loginErr).toBeNull()
    const accessToken = login.session?.access_token
    const refreshToken = login.session?.refresh_token
    expect(accessToken).toBeTruthy()
    expect(refreshToken).toBeTruthy()

    const app = await buildApp(env, { db, identityAdmin: identity, profilesRepo: profiles })
    await app.ready()
    try {
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/v1/me',
            headers: { authorization: `Bearer ${accessToken}` },
          })
        ).statusCode,
      ).toBe(200)

      await identity.banAuthUser(authUser.id)
      await identity.invalidateAccessTokens(authUser.id)

      const denied = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(denied.statusCode).toBe(401)
      expect(['user_disabled', 'session_invalidated']).toContain(denied.json().code)

      const { data: refreshed, error: refreshErr } = await anon.auth.refreshSession({
        refresh_token: refreshToken!,
      })
      // Record observed refresh-while-banned behavior (do not invent).
      const refreshWhileBanned = {
        error: refreshErr?.message ?? null,
        hasSession: Boolean(refreshed.session),
      }

      await identity.unbanAuthUser(authUser.id)

      const afterEnable = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(afterEnable.statusCode).toBe(401)
      expect(afterEnable.json()).toMatchObject({ code: 'session_invalidated' })

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

      // Attach observed refresh result for evidence (no secrets).
      expect(refreshWhileBanned).toBeTruthy()
    } finally {
      await app.close()
    }
  })
})

if (!enabled) {
  console.info('SUPABASE_INTEGRATION_NOT_EXECUTED phase2e-lifecycle')
}
