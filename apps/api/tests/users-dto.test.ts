import { describe, expect, it } from 'vitest'
import {
  parseChangeUserRoleBody,
  parseCreateUserBody,
  parseSetUserPasswordBody,
  parseUpdateOwnProfileBody,
  createUser,
  retryAuthCompensations,
} from '../src/application/users/users-service.js'
import type { AuthCompensationJob, AuthCompensationRepository } from '../src/infrastructure/db/auth-compensation-repository.js'
import { notFound } from '../src/http/errors/app-error.js'
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
  function memoryCompensation(): AuthCompensationRepository & { jobs: AuthCompensationJob[] } {
    const jobs: AuthCompensationJob[] = []
    return {
      jobs,
      async recordPending(authUserId) {
        if (jobs.some((job) => job.authUserId === authUserId && job.attempts < 5)) return
        jobs.push({ id: `job-${jobs.length + 1}`, authUserId, attempts: 0 })
      },
      async claimPending(limit) {
        return jobs.filter((job) => job.attempts < 5).slice(0, limit)
      },
      async mark(id, status, _errorCode, attempts) {
        const job = jobs.find((item) => item.id === id)
        if (!job) return
        job.attempts = attempts
        if (status !== 'pending') jobs.splice(jobs.indexOf(job), 1)
      },
    }
  }

  function deps(overrides: {
    identity?: Partial<IdentityAdmin>
    profiles?: Partial<ProfilesRepository>
    compensation?: AuthCompensationRepository
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
        tokensValidAfter: null,
      }),
      invalidateAccessTokens: async () => undefined,
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
      withAdminLifecycleLock: async (fn) =>
        fn({
          admins: [],
          tx: {
            updateRole: async () => {
              throw new Error('n/a')
            },
          },
        }),
      ...overrides.profiles,
    }
    return { identity, profiles, compensation: overrides.compensation ?? memoryCompensation() }
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

  it('records a durable job when compensate delete fails and hides provider details', async () => {
    const compensation = memoryCompensation()
    const logged: Array<Record<string, unknown>> = []
    await expect(
      createUser(
        {
          ...deps({
            identity: {
              async deleteAuthUser() {
                throw new AppError(502, 'auth_delete_failed', 'Identity provider error')
              },
            },
            compensation,
          }),
          logOrphan: (payload) => logged.push(payload),
        },
        {
          email: 'a@b.com',
          password: 'secret1',
          nombreCompleto: 'A',
          rol: 'supervisor',
        },
        { requestId: 'req-1' },
      ),
    ).rejects.toMatchObject({ code: 'user_create_failed', status: 500, details: undefined })
    expect(compensation.jobs).toEqual([
      { id: 'job-1', authUserId: '11111111-1111-4111-8111-111111111111', attempts: 0 },
    ])
    expect(JSON.stringify(logged)).not.toMatch(/secret1|service_role|Identity provider/)
    expect(logged.at(-1)).toMatchObject({
      requestId: 'req-1',
      authUserId: '11111111-1111-4111-8111-111111111111',
      operation: 'create_user',
      compensationAttempted: true,
      compensationSucceeded: false,
      errorClass: 'auth_delete_failed',
      durable: true,
    })
  })

  it('fails cleanly when Auth create fails', async () => {
    const compensation = memoryCompensation()
    await expect(
      createUser(
        deps({
          identity: {
            async createAuthUser() {
              throw new AppError(409, 'conflict', 'A user with this email already exists')
            },
          },
          compensation,
        }),
        {
          email: 'a@b.com',
          password: 'secret1',
          nombreCompleto: 'A',
          rol: 'supervisor',
        },
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(compensation.jobs).toEqual([])
  })

  it('retries a pending compensation and treats an already-deleted user as clean', async () => {
    const compensation = memoryCompensation()
    await compensation.recordPending('11111111-1111-4111-8111-111111111111')
    const deleted: string[] = []
    const base = deps({
      identity: {
        async deleteAuthUser(id) {
          deleted.push(id)
        },
      },
      compensation,
    })
    await expect(retryAuthCompensations(base, { limit: 5 })).resolves.toBe(1)
    expect(deleted).toEqual(['11111111-1111-4111-8111-111111111111'])
    expect(compensation.jobs).toEqual([])

    await compensation.recordPending('22222222-2222-4222-8222-222222222222')
    const again = deps({
      identity: {
        async deleteAuthUser() {
          throw notFound('User not found')
        },
      },
      compensation,
    })
    await expect(retryAuthCompensations(again, { limit: 5 })).resolves.toBe(1)
    expect(compensation.jobs).toEqual([])
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
      status: 'ACTIVE',
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
