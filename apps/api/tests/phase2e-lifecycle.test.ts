import { describe, expect, it } from 'vitest'
import {
  MFA_REQUIRED_ROLES,
  parseAal,
  roleRequiresMfa,
  sessionMeetsMfaRequirement,
} from '../src/domain/mfa-policy.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from '../src/domain/password-policy.js'
import {
  assertNotLastActiveAdminLocked,
  disableUser,
  enableUser,
} from '../src/application/users/users-service.js'
import {
  isAccessTokenInvalidated,
  type IdentityAdmin,
} from '../src/infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../src/infrastructure/db/profiles-repository.js'
import { AppError } from '../src/http/errors/app-error.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('password policy', () => {
  it('central schema matches product bounds', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6)
    expect(PASSWORD_MAX_LENGTH).toBe(200)
    expect(passwordSchema.safeParse('12345').success).toBe(false)
    expect(passwordSchema.safeParse('123456').success).toBe(true)
  })

  it('frontend password-policy.ts matches backend constants (parity)', () => {
    const fePath = join(process.cwd(), '../../src/lib/password-policy.ts')
    const src = readFileSync(fePath, 'utf8')
    expect(src).toMatch(new RegExp(`PASSWORD_MIN_LENGTH\\s*=\\s*${PASSWORD_MIN_LENGTH}`))
    expect(src).toMatch(new RegExp(`PASSWORD_MAX_LENGTH\\s*=\\s*${PASSWORD_MAX_LENGTH}`))
  })
})

describe('mfa policy fail-closed', () => {
  it('admin requires AAL2; missing/unknown never aal2', () => {
    expect(MFA_REQUIRED_ROLES).toEqual(['admin'])
    expect(roleRequiresMfa('admin')).toBe(true)
    expect(roleRequiresMfa('gerente')).toBe(false)
    expect(sessionMeetsMfaRequirement('admin', 'aal2')).toBe(true)
    expect(sessionMeetsMfaRequirement('admin', 'aal1')).toBe(false)
    expect(sessionMeetsMfaRequirement('admin', 'unknown')).toBe(false)
    expect(sessionMeetsMfaRequirement('compras', 'aal1')).toBe(true)
    expect(parseAal(undefined)).toBe('unknown')
    expect(parseAal(null)).toBe('unknown')
    expect(parseAal('aal2')).toBe('aal2')
  })
})

describe('tokens_valid_after invalidation', () => {
  it('rejects iat before epoch; missing iat fail-closed when epoch set', () => {
    const epoch = '2026-01-01T00:00:00.000Z'
    const before = Math.floor(Date.parse('2025-12-31T23:59:59.000Z') / 1000)
    const cutSec = Math.floor(Date.parse(epoch) / 1000)
    const after = cutSec + 1
    expect(isAccessTokenInvalidated(before, epoch)).toBe(true)
    expect(isAccessTokenInvalidated(cutSec, epoch)).toBe(true)
    expect(isAccessTokenInvalidated(after, epoch)).toBe(false)
    expect(isAccessTokenInvalidated(undefined, epoch)).toBe(true)
    expect(isAccessTokenInvalidated(after, null)).toBe(false)
  })

  it('Option A boundary: same-second iat after fractional cutoff is still invalidated', () => {
    // cutoff = 12:00:00.100 → cutSec = floor; JWT iat = 12:00:00 → DENY
    const epoch = '2026-06-15T12:00:00.100Z'
    const sameSecondIat = Math.floor(Date.parse('2026-06-15T12:00:00.800Z') / 1000)
    expect(sameSecondIat).toBe(Math.floor(Date.parse(epoch) / 1000))
    expect(isAccessTokenInvalidated(sameSecondIat, epoch)).toBe(true)
    expect(isAccessTokenInvalidated(sameSecondIat + 1, epoch)).toBe(false)
  })

  it('invalid tokens_valid_after string → DENY', () => {
    expect(isAccessTokenInvalidated(1_700_000_000, 'not-a-date')).toBe(true)
  })
})

describe('user lifecycle service', () => {
  const adminA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const adminB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const userC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  function stack(seed: ProfileRecord[]) {
    const profiles = new Map(seed.map((p) => [p.id, { ...p }]))
    const banned = new Set<string>()
    const tokensValidAfter = new Map<string, string>()
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
        tokensValidAfter: tokensValidAfter.get(id) ?? null,
      }),
      invalidateAccessTokens: async (id) => {
        tokensValidAfter.set(id, new Date().toISOString())
      },
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
      updateRole: async (userId, rol) => {
        const row = profiles.get(userId)
        if (!row) throw new AppError(404, 'not_found', 'Profile not found')
        row.rol = rol
        return { ...row }
      },
      withAdminLifecycleLock: async (fn) => {
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
    return { identity, profiles: profilesRepo, banned, tokensValidAfter, profileMap: profiles }
  }

  it('disable/enable: ban + invalidate; enable keeps tokens_valid_after', async () => {
    const s = stack([
      { id: adminA, nombre_completo: 'A', rol: 'admin' },
      { id: adminB, nombre_completo: 'B', rol: 'admin' },
      { id: userC, nombre_completo: 'C', rol: 'compras' },
    ])
    await disableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA })
    expect(s.banned.has(userC)).toBe(true)
    expect(s.tokensValidAfter.has(userC)).toBe(true)
    const epoch = s.tokensValidAfter.get(userC)!
    await enableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA })
    expect(s.banned.has(userC)).toBe(false)
    expect(s.tokensValidAfter.get(userC)).toBe(epoch)
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

  it('last active admin protected inside lock helper', async () => {
    const s = stack([{ id: adminA, nombre_completo: 'A', rol: 'admin' }])
    await expect(
      assertNotLastActiveAdminLocked(
        { identity: s.identity, profiles: s.profiles },
        [{ id: adminA, nombre_completo: 'A', rol: 'admin' }],
        adminA,
      ),
    ).rejects.toMatchObject({ code: 'last_admin_protected' })
  })

  it('invalidation failure after ban → 502 with banned true', async () => {
    const s = stack([
      { id: adminA, nombre_completo: 'A', rol: 'admin' },
      { id: adminB, nombre_completo: 'B', rol: 'admin' },
      { id: userC, nombre_completo: 'C', rol: 'compras' },
    ])
    s.identity.invalidateAccessTokens = async () => {
      throw new AppError(502, 'session_invalidation_failed', 'Identity provider error')
    }
    await expect(
      disableUser({ identity: s.identity, profiles: s.profiles }, userC, { userId: adminA }),
    ).rejects.toMatchObject({
      code: 'user_disabled_session_invalidation_failed',
      details: { banned: true, session_invalidation: 'failed' },
    })
    expect(s.banned.has(userC)).toBe(true)
  })

  it('demotion uses lock tx.updateRole (not pool updateRole)', async () => {
    const { changeUserRole } = await import('../src/application/users/users-service.js')
    const s = stack([
      { id: adminA, nombre_completo: 'A', rol: 'admin' },
      { id: adminB, nombre_completo: 'B', rol: 'admin' },
    ])
    let poolUpdateCalls = 0
    let txUpdateCalls = 0
    const origUpdate = s.profiles.updateRole.bind(s.profiles)
    s.profiles.updateRole = async (userId, rol) => {
      poolUpdateCalls += 1
      return origUpdate(userId, rol)
    }
    s.profiles.withAdminLifecycleLock = async (fn) => {
      const admins = [...s.profileMap.values()].filter((p) => p.rol === 'admin')
      return fn({
        admins,
        tx: {
          async updateRole(userId, rol) {
            txUpdateCalls += 1
            return origUpdate(userId, rol)
          },
        },
      })
    }
    await changeUserRole(
      { identity: s.identity, profiles: s.profiles },
      adminB,
      'compras',
      { actorUserId: adminA },
    )
    expect(txUpdateCalls).toBe(1)
    expect(poolUpdateCalls).toBe(0)
    expect(s.profileMap.get(adminB)?.rol).toBe('compras')
  })
})
