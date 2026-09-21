/**
 * Opt-in Phase 2E lifecycle against Supabase TEST.
 *
 * Refresh semantics (Option A tokens_valid_after):
 * - ACCESS: tokens_valid_after invalidates pre-disable access JWTs (including post-enable).
 * - REFRESH: no Admin revoke-by-user-id; after enable, wait past same-second boundary then
 *   refresh — if a new access is issued, iat must be after tokens_valid_after and /v1/me → 200.
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

  it(
    'access invalidation + refresh while banned + refresh after enable (Option A)',
    async () => {
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
    expect(typeof accessToken).toBe('string')
    expect(typeof refreshToken).toBe('string')

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

      const securityAfterInvalidate = await identity.getAuthUserSecurityState(authUser.id)
      const tokensValidAfter = securityAfterInvalidate.tokensValidAfter
      expect(typeof tokensValidAfter).toBe('string')
      const cutoffMs = Date.parse(tokensValidAfter!)
      expect(Number.isNaN(cutoffMs)).toBe(false)
      const cutoffSec = Math.floor(cutoffMs / 1000)

      const denied = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(denied.statusCode).toBe(401)
      expect(['user_disabled', 'session_invalidated']).toContain(
        (denied.json() as { code?: string }).code,
      )

      // CASE 1: refresh while DISABLED
      const bannedRefresh = await anon.auth.refreshSession({ refresh_token: refreshToken! })
      expect(
        bannedRefresh.error != null || bannedRefresh.data.session == null,
        'refresh while banned should fail or yield no session',
      ).toBe(true)

      await identity.unbanAuthUser(authUser.id)

      // Pre-disable access token remains dead after enable
      const afterEnable = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(afterEnable.statusCode).toBe(401)
      expect((afterEnable.json() as { code?: string }).code).toBe('session_invalidated')

      // CASE 2: wait past same-second boundary AFTER enable, BEFORE refreshSession(R)
      while (Math.floor(Date.now() / 1000) <= cutoffSec) {
        await new Promise((r) => setTimeout(r, 1100))
      }

      const enabledRefresh = await anon.auth.refreshSession({ refresh_token: refreshToken! })
      if (enabledRefresh.error || !enabledRefresh.data.session?.access_token) {
        expect(enabledRefresh.error != null || !enabledRefresh.data.session).toBe(true)
      } else {
        const newAccess = enabledRefresh.data.session.access_token
        expect(newAccess).not.toBe(accessToken)

        const payloadB64 = newAccess.split('.')[1]
        expect(typeof payloadB64).toBe('string')
        const payloadJson = Buffer.from(payloadB64!, 'base64url').toString('utf8')
        const payload = JSON.parse(payloadJson) as { iat?: number }
        expect(typeof payload.iat).toBe('number')
        expect(payload.iat!).toBeGreaterThan(cutoffSec)

        const viaRefresh = await app.inject({
          method: 'GET',
          url: '/v1/me',
          headers: { authorization: `Bearer ${newAccess}` },
        })
        expect(viaRefresh.statusCode).toBe(200)
      }
    } finally {
      await app.close()
    }
  },
  90_000,
  )
})

if (!enabled) {
  console.info('SUPABASE_INTEGRATION_NOT_EXECUTED phase2e-lifecycle')
}
