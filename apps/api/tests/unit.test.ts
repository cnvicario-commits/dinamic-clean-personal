import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { authorize, isRole, permissionsFor, type Role } from '../src/domain/rbac.js'
import { parseListEmployeesQuery } from '../src/application/employees/list-employees.js'
import { AppError } from '../src/http/errors/app-error.js'
import { loadProfile, assertAuthUserNotRevoked } from '../src/infrastructure/db/profiles-repo.js'
import { createMockDb, createProfileStubDb } from './helpers.js'
import { requirePermission } from '../src/http/plugins/auth.js'
import type { FastifyRequest } from 'fastify'

describe('config', () => {
  it('fails when required env missing', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'test',
        CORS_ORIGIN: 'http://localhost:3000',
        SUPABASE_URL: 'https://example.supabase.co',
      } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid configuration/)
  })

  it('loads valid env including SHUTDOWN_TIMEOUT_MS default', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      SUPABASE_URL: 'https://example.supabase.co',
    } as NodeJS.ProcessEnv)
    expect(env.PORT).toBe(3001)
    expect(env.SHUTDOWN_TIMEOUT_MS).toBe(10_000)
  })
})

describe('rbac', () => {
  it('denies unknown role', () => {
    expect(isRole('superadmin')).toBe(false)
  })

  it('allows employees:read for admin and gerente only', () => {
    expect(authorize({ role: 'admin' }, 'employees:read')).toBe(true)
    expect(authorize({ role: 'gerente' }, 'employees:read')).toBe(true)
    expect(authorize({ role: 'compras' }, 'employees:read')).toBe(false)
    expect(authorize({ role: 'supervisor' }, 'employees:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'employees:read')).toBe(false)
  })

  it('profile:read_self for all known roles', () => {
    for (const role of ['admin', 'gerente', 'compras', 'supervisor', 'auditoria'] as const) {
      expect(permissionsFor(role)).toContain('profile:read_self')
    }
  })

  it('requirePermission denies missing permission', async () => {
    const guard = requirePermission('employees:read')
    const deniedRoles: Role[] = ['compras', 'supervisor', 'auditoria']
    for (const role of deniedRoles) {
      const request = {
        auth: {
          userId: 'u',
          profileId: 'u',
          role,
          email: null,
          requestId: 'r',
        },
      } as FastifyRequest
      await expect(guard(request)).rejects.toMatchObject({ status: 403 })
    }
  })

  it('requirePermission allows admin and gerente for employees:read', async () => {
    const guard = requirePermission('employees:read')
    for (const role of ['admin', 'gerente'] as const) {
      const request = {
        auth: {
          userId: 'u',
          profileId: 'u',
          role,
          email: null,
          requestId: 'r',
        },
      } as FastifyRequest
      await expect(guard(request)).resolves.toBeUndefined()
    }
  })
})

describe('employees query parsing (strict Zod)', () => {
  it('accepts defaults and valid filters', () => {
    expect(parseListEmployeesQuery({})).toEqual({ page: 1, pageSize: 50 })
    expect(parseListEmployeesQuery({ page: '2', pageSize: '10', activo: 'true' })).toEqual({
      page: 2,
      pageSize: 10,
      activo: true,
    })
    expect(parseListEmployeesQuery({ activo: 'false' }).activo).toBe(false)
  })

  it('rejects invalid page', () => {
    for (const page of ['0', '-1', 'abc']) {
      expect(() => parseListEmployeesQuery({ page })).toThrow(AppError)
      try {
        parseListEmployeesQuery({ page })
      } catch (e) {
        expect(e).toMatchObject({ status: 400 })
      }
    }
  })

  it('rejects invalid pageSize', () => {
    for (const pageSize of ['0', '101', 'abc']) {
      expect(() => parseListEmployeesQuery({ pageSize })).toThrow(AppError)
      try {
        parseListEmployeesQuery({ pageSize })
      } catch (e) {
        expect(e).toMatchObject({ status: 400 })
      }
    }
  })

  it('rejects invalid activo', () => {
    expect(() => parseListEmployeesQuery({ activo: 'foo' })).toThrow(AppError)
    try {
      parseListEmployeesQuery({ activo: 'foo' })
    } catch (e) {
      expect(e).toMatchObject({ status: 400 })
    }
  })

  it('rejects unknown query keys', () => {
    expect(() => parseListEmployeesQuery({ foo: '1' })).toThrow(AppError)
    try {
      parseListEmployeesQuery({ foo: '1' })
    } catch (e) {
      expect(e).toMatchObject({ status: 400 })
    }
  })
})

describe('loadProfile / revocation', () => {
  const userId = '11111111-1111-1111-1111-111111111111'

  it('401 when profile missing', async () => {
    const db = createProfileStubDb({ profile: null })
    await expect(loadProfile(db, userId)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/profile/i),
    })
  })

  it('401 when auth user banned', async () => {
    const db = createProfileStubDb({
      profile: { id: userId, nombre_completo: 'A', rol: 'admin' },
      authUser: { banned_until: new Date(Date.now() + 60_000).toISOString(), deleted_at: null },
    })
    await expect(loadProfile(db, userId)).rejects.toMatchObject({
      status: 401,
      code: 'user_disabled',
      message: expect.stringMatching(/banned/i),
    })
  })

  it('401 when auth user deleted', async () => {
    const db = createProfileStubDb({
      profile: { id: userId, nombre_completo: 'A', rol: 'admin' },
      authUser: { banned_until: null, deleted_at: new Date().toISOString() },
    })
    await expect(loadProfile(db, userId)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/deleted/i),
    })
  })

  it('401 when auth.users row missing (queryable)', async () => {
    const db = createMockDb({
      async query(text) {
        const sql = text.replace(/\s+/g, ' ').toLowerCase()
        if (sql.includes('from public.perfiles')) {
          return {
            rows: [{ id: userId, nombre_completo: 'A', rol: 'admin' }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          }
        }
        if (sql.includes('from auth.users')) {
          return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }
        }
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }
      },
    })
    await expect(loadProfile(db, userId)).rejects.toMatchObject({ status: 401 })
  })

  it('continues when auth.users is not accessible (residual risk)', async () => {
    const db = createProfileStubDb({
      profile: { id: userId, nombre_completo: 'A', rol: 'gerente' },
      authUser: 'unavailable',
    })
    const profile = await loadProfile(db, userId)
    expect(profile.role).toBe('gerente')
  })

  it('assertAuthUserNotRevoked no-ops on access errors', async () => {
    const db = createMockDb({
      async query() {
        throw new Error('permission denied')
      },
    })
    await expect(assertAuthUserNotRevoked(db, userId)).resolves.toBeUndefined()
  })
})
