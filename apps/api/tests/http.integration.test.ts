import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import {
  createMockDb,
  createProfileStubDb,
  signAccessToken,
  testEnv,
} from './helpers.js'

const userId = '22222222-2222-2222-2222-222222222222'

describe('http offline (mock db + HS256)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const db = createProfileStubDb({
      profile: { id: userId, nombre_completo: 'Admin', rol: 'admin' },
      authUser: { banned_until: null, deleted_at: null },
      isReady: async () => true,
    })
    app = await buildApp(testEnv(), { db })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /healthz → 200 with X-Request-Id', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-request-id']).toBeTruthy()
  })

  it('GET /readyz → exactly 200 when DB ready', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /v1/me without token → 401 with X-Request-Id', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['x-request-id']).toBeTruthy()
    expect(String(res.headers['content-type'])).toMatch(/problem\+json|json/)
  })

  it('GET /v1/me with valid HS256 token → 200', async () => {
    const token = await signAccessToken({ sub: userId })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { role: string; userId: string }
    expect(body.role).toBe('admin')
    expect(body.userId).toBe(userId)
  })

  it('GET /v1/me with invalid token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer not-a-jwt' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /v1/employees without token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/employees' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /v1/employees invalid query → 400', async () => {
    const token = await signAccessToken({ sub: userId })
    const cases = [
      '/v1/employees?page=0',
      '/v1/employees?page=-1',
      '/v1/employees?page=abc',
      '/v1/employees?pageSize=0',
      '/v1/employees?pageSize=101',
      '/v1/employees?pageSize=abc',
      '/v1/employees?activo=foo',
      '/v1/employees?unknown=1',
    ]
    for (const url of cases) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode, url).toBe(400)
    }
  })

  it('GET /v1/employees admin → 200', async () => {
    const token = await signAccessToken({ sub: userId })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/employees?page=1&pageSize=10',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('http readiness 503 (mock isReady false)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const db = createMockDb({
      isReady: async () => false,
    })
    app = await buildApp(testEnv(), { db })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /readyz → exactly 503', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(503)
  })
})

describe('http RBAC employees:read via inject + stub role', () => {
  async function withRole(rol: string): Promise<FastifyInstance> {
    const db = createProfileStubDb({
      profile: { id: userId, nombre_completo: 'X', rol },
      authUser: { banned_until: null, deleted_at: null },
    })
    const app = await buildApp(testEnv(), { db })
    await app.ready()
    return app
  }

  it('allows admin and gerente', async () => {
    for (const rol of ['admin', 'gerente']) {
      const app = await withRole(rol)
      try {
        const token = await signAccessToken({ sub: userId })
        const res = await app.inject({
          method: 'GET',
          url: '/v1/employees',
          headers: { authorization: `Bearer ${token}` },
        })
        expect(res.statusCode, rol).toBe(200)
      } finally {
        await app.close()
      }
    }
  })

  it('denies compras, supervisor, auditoria, unknown', async () => {
    for (const rol of ['compras', 'supervisor', 'auditoria', 'unknown']) {
      const app = await withRole(rol)
      try {
        const token = await signAccessToken({ sub: userId })
        const res = await app.inject({
          method: 'GET',
          url: '/v1/employees',
          headers: { authorization: `Bearer ${token}` },
        })
        // unknown role → 403 from loadProfile; known without permission → 403 from requirePermission
        expect([403, 401]).toContain(res.statusCode)
        expect(res.statusCode).not.toBe(200)
        if (rol !== 'unknown') {
          expect(res.statusCode).toBe(403)
        }
      } finally {
        await app.close()
      }
    }
  })
})

describe('http auth revocation via stub', () => {
  it('banned auth user → 401 on /v1/me', async () => {
    const db = createProfileStubDb({
      profile: { id: userId, nombre_completo: 'A', rol: 'admin' },
      authUser: {
        banned_until: new Date(Date.now() + 120_000).toISOString(),
        deleted_at: null,
      },
    })
    const app = await buildApp(testEnv(), { db })
    await app.ready()
    try {
      const token = await signAccessToken({ sub: userId })
      const res = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('missing profile → 401 on /v1/me', async () => {
    const db = createProfileStubDb({ profile: null })
    const app = await buildApp(testEnv(), { db })
    await app.ready()
    try {
      const token = await signAccessToken({ sub: userId })
      const res = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })
})

const hasDb = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_URL)

describe.skipIf(!hasDb)('http integration (requires DATABASE_URL + SUPABASE_URL)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    if (!process.env.CORS_ORIGIN) process.env.CORS_ORIGIN = 'http://localhost:3000'
    if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = 'silent'
    const { loadEnv } = await import('../src/config/env.js')
    const env = loadEnv()
    app = await buildApp(env)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /healthz → 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /readyz → exactly 200 when DB available', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /v1/me without token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me' })
    expect(res.statusCode).toBe(401)
  })
})
