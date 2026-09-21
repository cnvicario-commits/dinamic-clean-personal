import { describe, expect, it } from 'vitest'
import {
  MFA_REQUIRED_ROLES,
  parseAal,
  roleRequiresMfa,
  sessionMeetsMfaRequirement,
} from '../src/domain/mfa-policy.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from '../src/domain/password-policy.js'
import {
  assertNotLastActiveAdmin,
  disableUser,
  enableUser,
} from '../src/application/users/users-service.js'
import type { IdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../src/infrastructure/db/profiles-repository.js'
import { AppError } from '../src/http/errors/app-error.js'

describe('password policy', () => {
  it('central schema matches product bounds', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6)
    expect(PASSWORD_MAX_LENGTH).toBe(200)
    expect(passwordSchema.safeParse('12345').success).toBe(false)
    expect(passwordSchema.safeParse('123456').success).toBe(true)
  })
})

describe('mfa policy', () => {
  it('admin requires AAL2; other roles do not', () => {
    expect(MFA_REQUIRED_ROLES).toEqual(['admin'])
    expect(roleRequiresMfa('admin')).toBe(true)
    expect(roleRequiresMfa('gerente')).toBe(false)
    expect(sessionMeetsMfaRequirement('admin', 'aal1')).toBe(false)
    expect(sessionMeetsMfaRequirement('admin', 'aal2')).toBe(true)
    expect(sessionMeetsMfaRequirement('compras', 'aal1')).toBe(true)
    expect(parseAal('aal2')).toBe('aal2')
    expect(parseAal(undefined)).toBe('unknown')
  })
})

describe('user lifecycle service', () => {
  const adminA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const adminB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const userC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  function stack(seed: ProfileRecord[]) {
    const profiles = new Map(seed.map((p) => [p.id, { ...p }]))
    const banned = new Set<string>()
    const identity: IdentityAdmin = {
      createAuthUser: async () => {
        throw new Error('n/a')
      },
      deleteAuthUser: async () => undefined,
      setAuthPassword: async () => undefined,
      listAuthEmails: async () => new Map(),
      banAuthUser: async (id) => {
        banned.add(id)
      },
      unbanAuthUser: async (id) => {
        banned.delete(id)
      },
      getAuthUserSecurityState: async (id) => ({
        id,
        email: null,
        status: banned.has(id) ? 'DISABLED' : 'ACTIVE',
        bannedUntil: banned.has(id) ? new Date(Date.now() + 1000).toISOString() : null,
      }),
      revokeUserSessions: async () => undefined,
      listAuthUserSecurityStates: async () => new Map(),
    }
    const profilesRepo: ProfilesRepository = {
      list: async () => [...profiles.values()],
      getById: async (id) => profiles.get(id) ?? null,
      updateNombreCompleto: async () => {
        throw new Error('n/a')
      },
      upsert: async () => {
        throw new Error('n/a')
      },
      updateRole: async () => {
        throw new Error('n/a')
      },
      withAdminProfilesLocked: async (fn) => fn([...profiles.values()].filter((p) => p.rol === 'admin')),
    }
    return { identity, profiles: profilesRepo, banned }
  }

  it('disable/enable happy path + idempotent', async () => {
    const s = stack([
      { id: adminA, nombre_completo: 'A', rol: 'admin' },
      { id: adminB, nombre_completo: 'B', rol: 'admin' },
      { id: userC, nombre_completo: 'C', rol: 'compras' },
    ])
    await disableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA })
    expect(s.banned.has(userC)).toBe(true)
    await disableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA })
    await enableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA })
    expect(s.banned.has(userC)).toBe(false)
  })

  it('self-disable forbidden', async () => {
    const s = stack([
      { id: adminA, nombre_completo: 'A', rol: 'admin' },
      { id: adminB, nombre_completo: 'B', rol: 'admin' },
    ])
    await expect(
      disableUser({ identity: s.identity, profiles: s.profiles }, adminA, { userId: adminA }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('last active admin protected', async () => {
    const s = stack([{ id: adminA, nombre_completo: 'A', rol: 'admin' }])
    await expect(
      assertNotLastActiveAdmin({ identity: s.identity, profiles: s.profiles }, adminA),
    ).rejects.toMatchObject({ code: 'last_admin_protected' })
  })

  it('missing user → 404', async () => {
    const s = stack([{ id: adminA, nombre_completo: 'A', rol: 'admin' }])
    await expect(
      disableUser(
        { identity: s.identity, profiles: s.profiles },
        userC,
        { userId: adminA },
      ),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('revoke failure after ban → 502 session_revocation_failed', async () => {
    const s = stack([
      { id: adminA, nombre_completo: 'A', rol: 'admin' },
      { id: adminB, nombre_completo: 'B', rol: 'admin' },
      { id: userC, nombre_completo: 'C', rol: 'compras' },
    ])
    s.identity.revokeUserSessions = async () => {
      throw new AppError(502, 'session_revocation_failed', 'Identity provider error')
    }
    await expect(
      disableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA }),
    ).rejects.toMatchObject({ code: 'session_revocation_failed' })
    expect(s.banned.has(userC)).toBe(true)
  })
})
