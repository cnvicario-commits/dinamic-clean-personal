import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import type { IdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../src/infrastructure/db/profiles-repository.js'
import {
  clearSensitiveRateLimitStore,
  createSensitiveRateLimitPreHandler,
  sensitiveRateLimitStore,
} from '../src/http/plugins/sensitive-rate-limit.js'
import { AppError } from '../src/http/errors/app-error.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'

const adminId = '22222222-2222-4222-8222-222222222222'
const adminBId = '33333333-3333-4333-8333-333333333333'

function memoryStack(seed: ProfileRecord[]) {
  const profiles = new Map(seed.map((p) => [p.id, { ...p }]))
  const emails = new Map(seed.map((p) => [p.id, `${p.rol}@example.com` as string | null]))

  const identity: IdentityAdmin = {
    async createAuthUser({ email }) {
      const id = crypto.randomUUID()
      emails.set(id, email)
      return { id, email }
    },
    async deleteAuthUser() {
      return
    },
    async setAuthPassword() {
      return
    },
    async listAuthEmails() {
      return new Map(emails)
    },
    async banAuthUser() {
      return
    },
    async unbanAuthUser() {
      return
    },
    async getAuthUserSecurityState(id) {
      return {
        id,
        email: emails.get(id) ?? null,
        status: 'ACTIVE',
        bannedUntil: null,
        tokensValidAfter: null,
      }
    },
    async invalidateAccessTokens() {
      return
    },
    async listAuthUserSecurityStates() {
      const map = new Map()
      for (const id of emails.keys()) {
        map.set(id, {
          id,
          email: emails.get(id) ?? null,
          status: 'ACTIVE',
          bannedUntil: null,
          tokensValidAfter: null,
        })
      }
      return map
    },
  }
  const profilesRepo: ProfilesRepository = {
    async list() {
      return [...profiles.values()]
    },
    async getById(id) {
      return profiles.get(id) ?? null
    },
    async updateNombreCompleto(userId, nombreCompleto) {
      const row = profiles.get(userId)
      if (!row) throw new AppError(404, 'not_found', 'Profile not found')
      row.nombre_completo = nombreCompleto
      return { ...row }
    },
    async upsert({ id, nombreCompleto, rol }) {
      const row = { id, nombre_completo: nombreCompleto, rol }
      profiles.set(id, row)
      return row
    },
    async updateRole(userId, rol) {
      const row = profiles.get(userId)
      if (!row) throw new AppError(404, 'not_found', 'Profile not found')
      row.rol = rol
      return { ...row }
    },
    async withAdminLifecycleLock(fn) {
      const admins = [...profiles.values()].filter((p) => p.rol === 'admin')
      return fn({
        admins,
        tx: {
          async updateRole(userId, rol) {
            const row = profiles.get(userId)
            if (!row) throw new AppError(404, 'not_found', 'Profile not found')
            row.rol = rol
            return { ...row }
          },
        },
      })
    },
  }
  return { identity, profilesRepo }
}

async function buildLimitedApp(opts?: {
  profileId?: string
  generalMax?: number
  sensitiveMax?: number
  windowMs?: number
}): Promise<FastifyInstance> {
  const profileId = opts?.profileId ?? adminId
  const stack = memoryStack([
    { id: adminId, nombre_completo: 'Admin A', rol: 'admin' },
    { id: adminBId, nombre_completo: 'Admin B', rol: 'admin' },
  ])
  const db = createProfileStubDb({
    profile: { id: profileId, nombre_completo: 'Admin', rol: 'admin' },
    authUser: { banned_until: null, deleted_at: null },
  })
  const app = await buildApp(
    testEnv({
      RATE_LIMIT_ENABLED: true,
      RATE_LIMIT_GENERAL_MAX: opts?.generalMax ?? 2,
      RATE_LIMIT_SENSITIVE_MAX: opts?.sensitiveMax ?? 2,
      RATE_LIMIT_WINDOW_MS: opts?.windowMs ?? 60_000,
    }),
    {
      db,
      identityAdmin: stack.identity,
      profilesRepo: stack.profilesRepo,
    },
  )
  await app.ready()
  return app
}

describe('phase2f rate limit', () => {
  beforeEach(() => {
    clearSensitiveRateLimitStore()
  })

  afterEach(() => {
    clearSensitiveRateLimitStore()
    vi.useRealTimers()
  })

  it('general limit: exceed → 429 + Retry-After + rate_limit_exceeded', async () => {
    const app = await buildLimitedApp({ generalMax: 2 })
    try {
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      const limited = await app.inject({ method: 'GET', url: '/v1/me' })
      expect(limited.statusCode).toBe(429)
      expect(limited.headers['retry-after']).toBeTruthy()
      expect(limited.headers['content-type']).toMatch(/problem\+json/)
      expect(limited.json()).toMatchObject({ code: 'rate_limit_exceeded', status: 429 })
    } finally {
      await app.close()
    }
  })

  it('general limit resets after window (fake timers)', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') })
    const app = await buildLimitedApp({ generalMax: 2, windowMs: 60_000 })
    try {
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(429)

      vi.advanceTimersByTime(60_001)

      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('healthz is excluded from general budget', async () => {
    const app = await buildLimitedApp({ generalMax: 2 })
    try {
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(429)

      const health = await app.inject({ method: 'GET', url: '/healthz' })
      expect(health.statusCode).toBe(200)
      expect(health.json()).toEqual({ status: 'ok' })

      const openapi = await app.inject({ method: 'GET', url: '/openapi.json' })
      expect(openapi.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('missing auth on protected mutation → 401 not 429', async () => {
    const app = await buildLimitedApp({ sensitiveMax: 1, generalMax: 100 })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/users',
        payload: {
          email: 'new@example.com',
          password: 'Str0ng!Passw0rd',
          nombreCompleto: 'New User',
          rol: 'compras',
        },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toMatchObject({ code: 'unauthorized' })
    } finally {
      await app.close()
    }
  })

  it('different users do not share sensitive bucket', async () => {
    let now = Date.parse('2026-01-01T00:00:00.000Z')
    const store = sensitiveRateLimitStore
    clearSensitiveRateLimitStore(store)
    const preHandler = createSensitiveRateLimitPreHandler({
      max: 2,
      windowMs: 60_000,
      store,
      now: () => now,
    })

    const reply = {
      header: () => reply,
    } as unknown as Parameters<typeof preHandler>[1]

    const mkReq = (userId: string) =>
      ({
        auth: { userId },
        id: 'r',
        method: 'POST',
        url: '/v1/users',
        routeOptions: { url: '/v1/users' },
        log: { warn: () => undefined },
      }) as unknown as Parameters<typeof preHandler>[0]

    await preHandler(mkReq(adminId), reply)
    await preHandler(mkReq(adminId), reply)
    await expect(preHandler(mkReq(adminId), reply)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limit_exceeded',
    })

    await preHandler(mkReq(adminBId), reply)
    await preHandler(mkReq(adminBId), reply)
    await expect(preHandler(mkReq(adminBId), reply)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limit_exceeded',
    })

    now += 60_001
    await expect(preHandler(mkReq(adminId), reply)).resolves.toBeUndefined()
  })

  it('sensitive HTTP limit is per userId', async () => {
    const stack = memoryStack([
      { id: adminId, nombre_completo: 'Admin A', rol: 'admin' },
      { id: adminBId, nombre_completo: 'Admin B', rol: 'admin' },
    ])

    async function appAs(userId: string) {
      const db = createProfileStubDb({
        profile: {
          id: userId,
          nombre_completo: 'Admin',
          rol: 'admin',
        },
        authUser: { banned_until: null, deleted_at: null },
      })
      const app = await buildApp(
        testEnv({
          RATE_LIMIT_ENABLED: true,
          RATE_LIMIT_GENERAL_MAX: 1000,
          RATE_LIMIT_SENSITIVE_MAX: 2,
          RATE_LIMIT_WINDOW_MS: 60_000,
        }),
        {
          db,
          identityAdmin: stack.identity,
          profilesRepo: stack.profilesRepo,
        },
      )
      await app.ready()
      return app
    }

    const appA = await appAs(adminId)
    const appB = await appAs(adminBId)
    try {
      const tokenA = await signAccessToken({ sub: adminId })
      const tokenB = await signAccessToken({ sub: adminBId })
      const payload = {
        email: `u-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        nombreCompleto: 'New User',
        rol: 'compras',
      }

      expect(
        (
          await appA.inject({
            method: 'POST',
            url: '/v1/users',
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { ...payload, email: `a1-${crypto.randomUUID()}@example.com` },
          })
        ).statusCode,
      ).toBe(201)
      expect(
        (
          await appA.inject({
            method: 'POST',
            url: '/v1/users',
            headers: { authorization: `Bearer ${tokenA}` },
            payload: { ...payload, email: `a2-${crypto.randomUUID()}@example.com` },
          })
        ).statusCode,
      ).toBe(201)
      const limitedA = await appA.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { ...payload, email: `a3-${crypto.randomUUID()}@example.com` },
      })
      expect(limitedA.statusCode).toBe(429)
      expect(limitedA.headers['retry-after']).toBeTruthy()
      expect(limitedA.json()).toMatchObject({ code: 'rate_limit_exceeded' })

      // Same in-memory sensitive store is process-wide — user B still has budget.
      const okB = await appB.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { ...payload, email: `b1-${crypto.randomUUID()}@example.com` },
      })
      expect(okB.statusCode).toBe(201)
    } finally {
      await appA.close()
      await appB.close()
    }
  })

  it('general and sensitive 429 share Problem Details keys + problem+json', async () => {
    const problemKeys = ['type', 'title', 'status', 'detail', 'code', 'requestId'] as const

    const generalApp = await buildLimitedApp({ generalMax: 1 })
    let generalBody: Record<string, unknown>
    try {
      expect((await generalApp.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401)
      const generalLimited = await generalApp.inject({ method: 'GET', url: '/v1/me' })
      expect(generalLimited.statusCode).toBe(429)
      expect(generalLimited.headers['content-type']).toMatch(/problem\+json/)
      expect(generalLimited.headers['retry-after']).toBeTruthy()
      generalBody = generalLimited.json() as Record<string, unknown>
      for (const key of problemKeys) {
        expect(generalBody).toHaveProperty(key)
      }
      expect(generalBody).toMatchObject({ code: 'rate_limit_exceeded', status: 429 })
    } finally {
      await generalApp.close()
    }

    clearSensitiveRateLimitStore()
    const stack = memoryStack([
      { id: adminId, nombre_completo: 'Admin A', rol: 'admin' },
      { id: adminBId, nombre_completo: 'Admin B', rol: 'admin' },
    ])
    const db = createProfileStubDb({
      profile: { id: adminId, nombre_completo: 'Admin', rol: 'admin' },
      authUser: { banned_until: null, deleted_at: null },
    })
    const sensitiveApp = await buildApp(
      testEnv({
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_GENERAL_MAX: 1000,
        RATE_LIMIT_SENSITIVE_MAX: 1,
        RATE_LIMIT_WINDOW_MS: 60_000,
      }),
      {
        db,
        identityAdmin: stack.identity,
        profilesRepo: stack.profilesRepo,
      },
    )
    await sensitiveApp.ready()
    try {
      const token = await signAccessToken({ sub: adminId })
      const payload = {
        email: `u-${crypto.randomUUID()}@example.com`,
        password: 'Str0ng!Passw0rd',
        nombreCompleto: 'New User',
        rol: 'compras',
      }
      expect(
        (
          await sensitiveApp.inject({
            method: 'POST',
            url: '/v1/users',
            headers: { authorization: `Bearer ${token}` },
            payload: { ...payload, email: `s1-${crypto.randomUUID()}@example.com` },
          })
        ).statusCode,
      ).toBe(201)
      const sensitiveLimited = await sensitiveApp.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...payload, email: `s2-${crypto.randomUUID()}@example.com` },
      })
      expect(sensitiveLimited.statusCode).toBe(429)
      expect(sensitiveLimited.headers['content-type']).toMatch(/problem\+json/)
      expect(sensitiveLimited.headers['retry-after']).toBeTruthy()
      const sensitiveBody = sensitiveLimited.json() as Record<string, unknown>
      for (const key of problemKeys) {
        expect(sensitiveBody).toHaveProperty(key)
      }
      expect(sensitiveBody).toMatchObject({ code: 'rate_limit_exceeded', status: 429 })

      expect(problemKeys.every((k) => k in generalBody && k in sensitiveBody)).toBe(true)
    } finally {
      await sensitiveApp.close()
    }
  })
})
