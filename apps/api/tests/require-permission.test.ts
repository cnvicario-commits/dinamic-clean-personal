import { describe, expect, it } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { authorize, permissionsFor, type Permission, type Role } from '../src/domain/rbac.js'
import { requirePermission } from '../src/http/plugins/auth.js'
import { buildApp } from '../src/app.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'

const userId = '33333333-3333-3333-3333-333333333333'

function authRequest(role: Role): FastifyRequest {
  return {
    auth: {
      userId: 'u',
      profileId: 'u',
      role,
      email: null,
      requestId: 'r',
    },
  } as FastifyRequest
}

describe('requirePermission HTTP guard (canonical authorize)', () => {
  it('A. request without auth → 401', async () => {
    const guard = requirePermission('employees:read')
    await expect(guard({} as FastifyRequest)).rejects.toMatchObject({ status: 401 })
    await expect(guard({ auth: undefined } as FastifyRequest)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('B. auth present without permission → 403', async () => {
    const guard = requirePermission('employees:read')
    for (const role of ['compras', 'supervisor', 'auditoria'] as const) {
      await expect(guard(authRequest(role))).rejects.toMatchObject({ status: 403 })
    }
  })

  it('C. auth present with explicit permission → continues', async () => {
    const guard = requirePermission('employees:read')
    for (const role of ['admin', 'gerente'] as const) {
      await expect(guard(authRequest(role))).resolves.toBeUndefined()
    }
    const meGuard = requirePermission('profile:read_self')
    for (const role of ['admin', 'gerente', 'compras', 'supervisor', 'auditoria'] as const) {
      await expect(meGuard(authRequest(role))).resolves.toBeUndefined()
    }
  })

  it('D. invalid role on subject → DENY (403)', async () => {
    const guard = requirePermission('profile:read_self')
    const request = {
      auth: {
        userId: 'u',
        profileId: 'u',
        role: 'not-a-role',
        email: null,
        requestId: 'r',
      },
    } as unknown as FastifyRequest
    expect(authorize({ role: 'not-a-role' }, 'profile:read_self')).toBe(false)
    await expect(guard(request)).rejects.toMatchObject({ status: 403 })
  })

  it('E. guard outcomes match canonical authorize() for all role×permission pairs', async () => {
    const roles: Role[] = ['admin', 'gerente', 'compras', 'supervisor', 'auditoria']
    const permissions: Permission[] = ['profile:read_self', 'employees:read']
    for (const permission of permissions) {
      const guard = requirePermission(permission)
      for (const role of roles) {
        const allowed = authorize({ role }, permission)
        expect(allowed).toBe(permissionsFor(role).includes(permission))
        if (allowed) {
          await expect(guard(authRequest(role))).resolves.toBeUndefined()
        } else {
          await expect(guard(authRequest(role))).rejects.toMatchObject({ status: 403 })
        }
      }
    }
  })
})

describe('requirePermission via Fastify inject (HTTP integration)', () => {
  it('A. GET /v1/employees without token → 401', async () => {
    const app = await buildApp(testEnv(), {
      db: createProfileStubDb({
        profile: { id: userId, nombre_completo: 'A', rol: 'admin' },
        authUser: { banned_until: null, deleted_at: null },
      }),
    })
    await app.ready()
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/employees' })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('B. GET /v1/employees as compras → 403 (auth ok, permission missing)', async () => {
    const app = await buildApp(testEnv(), {
      db: createProfileStubDb({
        profile: { id: userId, nombre_completo: 'C', rol: 'compras' },
        authUser: { banned_until: null, deleted_at: null },
      }),
    })
    await app.ready()
    try {
      const token = await signAccessToken({ sub: userId })
      const res = await app.inject({
        method: 'GET',
        url: '/v1/employees',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
    } finally {
      await app.close()
    }
  })

  it('C. GET /v1/employees as admin → 200', async () => {
    const app = await buildApp(testEnv(), {
      db: createProfileStubDb({
        profile: { id: userId, nombre_completo: 'Admin', rol: 'admin' },
        authUser: { banned_until: null, deleted_at: null },
      }),
    })
    await app.ready()
    try {
      const token = await signAccessToken({ sub: userId })
      const res = await app.inject({
        method: 'GET',
        url: '/v1/employees?page=1&pageSize=10',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('D. unknown role in perfiles → not 200 on protected route', async () => {
    const app = await buildApp(testEnv(), {
      db: createProfileStubDb({
        profile: { id: userId, nombre_completo: 'X', rol: 'unknown' },
        authUser: { banned_until: null, deleted_at: null },
      }),
    })
    await app.ready()
    try {
      const token = await signAccessToken({ sub: userId })
      const res = await app.inject({
        method: 'GET',
        url: '/v1/employees',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).not.toBe(200)
      expect([401, 403]).toContain(res.statusCode)
    } finally {
      await app.close()
    }
  })
})
