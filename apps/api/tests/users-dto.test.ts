import { describe, expect, it } from 'vitest'
import {
  parseChangeUserRoleBody,
  parseCreateUserBody,
  parseSetUserPasswordBody,
  parseUpdateOwnProfileBody,
  createUser,
} from '../src/application/users/users-service.js'
import type { IdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../src/infrastructure/db/profiles-repository.js'
import { AppError } from '../src/http/errors/app-error.js'
import { mapAuthAdminError } from '../src/infrastructure/auth/identity-admin.js'
import { assertUsersModuleConfig } from '../src/app.js'
import { testEnv } from './helpers.js'

describe('users/profile DTOs (strict allowlist)', () => {
  it('accepts valid self update', () => {
    expect(parseUpdateOwnProfileBody({ nombreCompleto: 'Ana Pérez' })).toEqual({
      nombreCompleto: 'Ana Pérez',
    })
  })

  it('rejects privileged / unknown self fields (no silent strip)', () => {
    for (const body of [
      { nombreCompleto: 'Ana', rol: 'admin' },
      { nombreCompleto: 'Ana', role: 'admin' },
      { nombreCompleto: 'Ana', permissions: ['*'] },
      { nombreCompleto: 'Ana', id: 'x' },
      { nombreCompleto: 'Ana', is_admin: true },
      { nombreCompleto: 'Ana', extra: true },
      {},
    ]) {
      expect(() => parseUpdateOwnProfileBody(body)).toThrow(AppError)
    }
  })

  it('create user validates email, password, role, unknown keys', () => {
    expect(() =>
      parseCreateUserBody({
        email: 'bad',
        password: 'secret1',
        nombreCompleto: 'A',
        rol: 'compras',
      }),
    ).toThrow(AppError)
    expect(() =>
      parseCreateUserBody({
        email: 'a@b.com',
        password: '123',
        nombreCompleto: 'A',
        rol: 'compras',
      }),
    ).toThrow(AppError)
    expect(() =>
      parseCreateUserBody({
        email: 'a@b.com',
        password: 'secret1',
        nombreCompleto: 'A',
        rol: 'nope',
      }),
    ).toThrow(AppError)
    expect(() =>
      parseCreateUserBody({
        email: 'a@b.com',
        password: 'secret1',
        nombreCompleto: 'A',
        rol: 'compras',
        isAdmin: true,
      }),
    ).toThrow(AppError)
    expect(
      parseCreateUserBody({
        email: 'a@b.com',
        password: 'secret1',
        nombreCompleto: 'A',
        rol: 'compras',
      }).rol,
    ).toBe('compras')
  })

  it('change role / set password are exact DTOs', () => {
    expect(parseChangeUserRoleBody({ rol: 'gerente' })).toEqual({ rol: 'gerente' })
    expect(() => parseChangeUserRoleBody({ rol: 'admin', password: 'x' })).toThrow(AppError)
    expect(parseSetUserPasswordBody({ password: 'secret1' }).password).toBe('secret1')
    expect(() => parseSetUserPasswordBody({ password: '123' })).toThrow(AppError)
  })
})

describe('createUser compensation', () => {
  function deps(overrides: {
    identity?: Partial<IdentityAdmin>
    profiles?: Partial<ProfilesRepository>
  }) {
    const identity: IdentityAdmin = {
      createAuthUser: async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'a@b.com',
      }),
      deleteAuthUser: async () => undefined,
      setAuthPassword: async () => undefined,
      listAuthEmails: async () => new Map(),
      banAuthUser: async () => undefined,
      unbanAuthUser: async () => undefined,
      getAuthUserSecurityState: async (id) => ({
        id,
        email: null,
        status: 'ACTIVE',
        bannedUntil: null,
      }),
      revokeUserSessions: async () => undefined,
      listAuthUserSecurityStates: async () => new Map(),
      ...overrides.identity,
    }
    const profiles: ProfilesRepository = {
      list: async () => [],
      getById: async () => null,
      updateNombreCompleto: async () => {
        throw new Error('n/a')
      },
      upsert: async () => {
        throw new AppError(500, 'db', 'upsert failed')
      },
      updateRole: async () => {
        throw new Error('n/a')
      },
      withAdminProfilesLocked: async (fn) => fn([]),
      ...overrides.profiles,
    }
    return { identity, profiles }
  }

  it('deletes Auth user when profile upsert fails', async () => {
    const deleted: string[] = []
    await expect(
      createUser(
        deps({
          identity: {
            async deleteAuthUser(id) {
              deleted.push(id)
            },
          },
        }),
        {
          email: 'a@b.com',
          password: 'secret1',
          nombreCompleto: 'A',
          rol: 'supervisor',
        },
      ),
    ).rejects.toMatchObject({ message: 'upsert failed' })
    expect(deleted).toEqual(['11111111-1111-4111-8111-111111111111'])
  })

  it('orphan when compensate delete fails — never success', async () => {
    await expect(
      createUser(
        deps({
          identity: {
            async deleteAuthUser() {
              throw new AppError(502, 'auth_delete_failed', 'Identity provider error')
            },
          },
        }),
        {
          email: 'a@b.com',
          password: 'secret1',
          nombreCompleto: 'A',
          rol: 'supervisor',
        },
        { requestId: 'req-1' },
      ),
    ).rejects.toMatchObject({ code: 'user_create_orphan', status: 500 })
  })

  it('returns admin user on success', async () => {
    const row: ProfileRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      nombre_completo: 'A',
      rol: 'supervisor',
    }
    const created = await createUser(
      deps({
        profiles: {
          async upsert() {
            return row
          },
        },
      }),
      {
        email: 'a@b.com',
        password: 'secret1',
        nombreCompleto: 'A',
        rol: 'supervisor',
      },
    )
    expect(created).toEqual({
      id: row.id,
      nombreCompleto: 'A',
      rol: 'supervisor',
      email: 'a@b.com',
      disabled: false,
    })
  })
})

describe('auth error mapping / readiness', () => {
  it('maps duplicate Auth errors to 409 conflict', () => {
    const err = mapAuthAdminError({ message: 'User already registered' }, 'x')
    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(409)
    expect(err.message).not.toMatch(/registered/i)
  })

  it('production requires SERVICE_ROLE_KEY', () => {
    expect(() =>
      assertUsersModuleConfig(testEnv({ NODE_ENV: 'production' }), {}),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('test env may omit SERVICE_ROLE_KEY when injecting', () => {
    expect(() => assertUsersModuleConfig(testEnv({ NODE_ENV: 'test' }), {})).not.toThrow()
  })
})
