import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import type { IdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../src/infrastructure/db/profiles-repository.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'
import { AppError, conflict } from '../src/http/errors/app-error.js'

const adminId = '22222222-2222-4222-8222-222222222222'
const otherId = '44444444-4444-4444-8444-444444444444'

function memoryStack(seed: ProfileRecord[]) {
  const profiles = new Map(seed.map((p) => [p.id, { ...p }]))
  const emails = new Map(seed.map((p) => [p.id, `${p.rol}@example.com` as string | null]))
  const identity: IdentityAdmin = {
    async createAuthUser({ email }) {
      if ([...emails.values()].includes(email)) {
        throw conflict('A user with this email already exists')
      }
      const id = crypto.randomUUID()
      emails.set(id, email)
      return { id, email }
    },
    async deleteAuthUser(id) {
      profiles.delete(id)
      emails.delete(id)
    },
    async setAuthPassword() {
      return
    },
    async listAuthEmails() {
      return new Map(emails)
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
  }
  return { identity, profilesRepo, emails, profiles }
}

async function appForRole(
  rol: string,
  stack = memoryStack([
    { id: adminId, nombre_completo: 'Caller', rol },
    { id: otherId, nombre_completo: 'Other', rol: 'compras' },
  ]),
): Promise<FastifyInstance> {
  const db = createProfileStubDb({
    profile: { id: adminId, nombre_completo: 'Caller', rol },
    authUser: { banned_until: null, deleted_at: null },
  })
  const app = await buildApp(testEnv(), {
    db,
    identityAdmin: stack.identity,
    profilesRepo: stack.profilesRepo,
  })
  await app.ready()
  return app
}

describe('readyz users module', () => {
  it('DB unavailable → 503 (database)', async () => {
    const db = createProfileStubDb({
      profile: { id: adminId, nombre_completo: 'A', rol: 'admin' },
      isReady: async () => false,
    })
    const stack = memoryStack([{ id: adminId, nombre_completo: 'A', rol: 'admin' }])
    const app = await buildApp(testEnv({ NODE_ENV: 'test' }), {
      db,
      identityAdmin: stack.identity,
      profilesRepo: stack.profilesRepo,
    })
    await app.ready()
    try {
      const res = await app.inject({ method: 'GET', url: '/readyz' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ reason: 'database' })
    } finally {
      await app.close()
    }
  })

  it('DB ready + users dependencies unavailable (stubs) → 503', async () => {
    const db = createProfileStubDb({
      profile: { id: adminId, nombre_completo: 'A', rol: 'admin' },
      isReady: async () => true,
    })
    // No identityAdmin / profilesRepo and no SERVICE_ROLE_KEY → stubs → not ready
    const app = await buildApp(testEnv({ NODE_ENV: 'test' }), {
      db,
    })
    await app.ready()
    try {
      expect(app.usersModuleReady).toBe(false)
      const res = await app.inject({ method: 'GET', url: '/readyz' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ reason: 'users_module_dependency' })
    } finally {
      await app.close()
    }
  })

  it('DB ready + users dependencies functional → 200', async () => {
    const db = createProfileStubDb({
      profile: { id: adminId, nombre_completo: 'A', rol: 'admin' },
      isReady: async () => true,
    })
    const stack = memoryStack([{ id: adminId, nombre_completo: 'A', rol: 'admin' }])
    const app = await buildApp(testEnv({ NODE_ENV: 'test' }), {
      db,
      identityAdmin: stack.identity,
      profilesRepo: stack.profilesRepo,
    })
    await app.ready()
    try {
      expect(app.usersModuleReady).toBe(true)
      const res = await app.inject({ method: 'GET', url: '/readyz' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ status: 'ready' })
    } finally {
      await app.close()
    }
  })
})

describe('users/profiles HTTP authorization', () => {
  it('GET /v1/users: no JWT → 401; non-admin → 403; admin → 200', async () => {
    for (const rol of ['compras', 'supervisor', 'auditoria', 'gerente'] as const) {
      const app = await appForRole(rol)
      try {
        const token = await signAccessToken({ sub: adminId })
        const res = await app.inject({
          method: 'GET',
          url: '/v1/users',
          headers: { authorization: `Bearer ${token}` },
        })
        expect(res.statusCode, rol).toBe(403)
      } finally {
        await app.close()
      }
    }
    const adminApp = await appForRole('admin')
    try {
      expect((await adminApp.inject({ method: 'GET', url: '/v1/users' })).statusCode).toBe(401)
      const token = await signAccessToken({ sub: adminId })
      const res = await adminApp.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { items: { email: string | null }[] }
      expect(body.items[0]).toHaveProperty('email')
    } finally {
      await adminApp.close()
    }
  })

  it('POST /v1/users: deny non-admin; admin 201; duplicate 409; invalid 400', async () => {
    const stack = memoryStack([{ id: adminId, nombre_completo: 'Caller', rol: 'admin' }])
    const app = await appForRole('admin', stack)
    try {
      const token = await signAccessToken({ sub: adminId })
      const bad = await app.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: { email: 'x', password: '1', nombreCompleto: 'A', rol: 'compras' },
      })
      expect(bad.statusCode).toBe(400)

      const ok = await app.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: {
          email: 'nuevo@example.com',
          password: 'secret12',
          nombreCompleto: 'Nuevo',
          rol: 'compras',
        },
      })
      expect(ok.statusCode).toBe(201)

      const dup = await app.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: {
          email: 'nuevo@example.com',
          password: 'secret12',
          nombreCompleto: 'Otro',
          rol: 'compras',
        },
      })
      expect(dup.statusCode).toBe(409)
    } finally {
      await app.close()
    }

    const denied = await appForRole('compras')
    try {
      const token = await signAccessToken({ sub: adminId })
      const res = await denied.inject({
        method: 'POST',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: {
          email: 'x@y.com',
          password: 'secret12',
          nombreCompleto: 'X',
          rol: 'compras',
        },
      })
      expect(res.statusCode).toBe(403)
    } finally {
      await denied.close()
    }
  })

  it('GET /v1/users/:id: 400/403/404/200', async () => {
    const app = await appForRole('admin')
    try {
      const token = await signAccessToken({ sub: adminId })
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/v1/users/not-a-uuid',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/v1/users/55555555-5555-4555-8555-555555555555',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(404)
      const ok = await app.inject({
        method: 'GET',
        url: `/v1/users/${otherId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(ok.statusCode).toBe(200)
      expect(ok.json()).toHaveProperty('email')
    } finally {
      await app.close()
    }
    const denied = await appForRole('gerente')
    try {
      const token = await signAccessToken({ sub: adminId })
      expect(
        (
          await denied.inject({
            method: 'GET',
            url: `/v1/users/${otherId}`,
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(403)
    } finally {
      await denied.close()
    }
  })

  it('PATCH role: deny non-admin including gerente; admin 200; bad role 400; missing 404', async () => {
    for (const rol of ['compras', 'supervisor', 'auditoria', 'gerente'] as const) {
      const app = await appForRole(rol)
      try {
        const token = await signAccessToken({ sub: adminId })
        const res = await app.inject({
          method: 'PATCH',
          url: `/v1/users/${otherId}/role`,
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          payload: { rol: 'admin' },
        })
        expect(res.statusCode, rol).toBe(403)
      } finally {
        await app.close()
      }
    }
    const app = await appForRole('admin')
    try {
      const token = await signAccessToken({ sub: adminId })
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/v1/users/${otherId}/role`,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            payload: { rol: 'nope' },
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/v1/users/55555555-5555-4555-8555-555555555555/role',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            payload: { rol: 'supervisor' },
          })
        ).statusCode,
      ).toBe(404)
      const ok = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${otherId}/role`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: { rol: 'supervisor' },
      })
      expect(ok.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('POST password: deny / 204 / 400 / 404', async () => {
    const denied = await appForRole('compras')
    try {
      const token = await signAccessToken({ sub: adminId })
      expect(
        (
          await denied.inject({
            method: 'POST',
            url: `/v1/users/${otherId}/password`,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            payload: { password: 'secret12' },
          })
        ).statusCode,
      ).toBe(403)
    } finally {
      await denied.close()
    }
    const app = await appForRole('admin')
    try {
      const token = await signAccessToken({ sub: adminId })
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/v1/users/${otherId}/password`,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            payload: { password: '123' },
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/users/55555555-5555-4555-8555-555555555555/password',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            payload: { password: 'secret12' },
          })
        ).statusCode,
      ).toBe(404)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/v1/users/${otherId}/password`,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            payload: { password: 'secret12' },
          })
        ).statusCode,
      ).toBe(204)
    } finally {
      await app.close()
    }
  })

  it('PATCH /me: 200 valid; reject role/unknown; cannot target other user via body', async () => {
    const app = await appForRole('compras')
    try {
      const token = await signAccessToken({ sub: adminId })
      const ok = await app.inject({
        method: 'PATCH',
        url: '/v1/me',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: { nombreCompleto: 'Nuevo Nombre' },
      })
      expect(ok.statusCode).toBe(200)
      expect(ok.json()).toMatchObject({ nombreCompleto: 'Nuevo Nombre', id: adminId })

      for (const payload of [
        { nombreCompleto: 'X', rol: 'admin' },
        { nombreCompleto: 'X', role: 'admin' },
        { nombreCompleto: 'X', id: otherId },
        { nombreCompleto: 'X', permissions: [] },
      ]) {
        const res = await app.inject({
          method: 'PATCH',
          url: '/v1/me',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          payload,
        })
        expect(res.statusCode).toBe(400)
      }
    } finally {
      await app.close()
    }
  })
})
