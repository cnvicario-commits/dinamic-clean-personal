import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import type { IdentityAdmin } from '../src/infrastructure/auth/identity-admin.js'
import type { ProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { createMockDb, testEnv } from './helpers.js'

const noopIdentity = {
  createAuthUser: async () => {
    throw new Error('unused')
  },
  deleteAuthUser: async () => undefined,
  setAuthPassword: async () => undefined,
  listAuthEmails: async () => new Map(),
  banAuthUser: async () => undefined,
  unbanAuthUser: async () => undefined,
  getAuthUserSecurityState: async () => {
    throw new Error('unused')
  },
  invalidateAccessTokens: async () => undefined,
  listAuthUserSecurityStates: async () => new Map(),
} as IdentityAdmin

const noopProfiles = {
  list: async () => [],
  getById: async () => null,
  updateNombreCompleto: async () => {
    throw new Error('unused')
  },
  upsert: async () => {
    throw new Error('unused')
  },
  updateRole: async () => {
    throw new Error('unused')
  },
  withAdminLifecycleLock: async (fn) =>
    fn({
      admins: [],
      tx: {
        updateRole: async () => {
          throw new Error('unused')
        },
      },
    }),
} as ProfilesRepository

describe('phase2f security headers', () => {
  it('sets nosniff, referrer-policy, x-frame-options DENY, permissions-policy', async () => {
    const app = await buildApp(testEnv(), {
      db: createMockDb({}),
      identityAdmin: noopIdentity,
      profilesRepo: noopProfiles,
    })
    await app.ready()
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(res.headers['x-frame-options']).toBe('DENY')
      expect(res.headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=()',
      )
      expect(res.headers['strict-transport-security']).toBeUndefined()
    } finally {
      await app.close()
    }
  })

  it('omits HSTS outside production', async () => {
    for (const NODE_ENV of ['test', 'development'] as const) {
      const app = await buildApp(testEnv({ NODE_ENV }), {
        db: createMockDb({}),
        identityAdmin: noopIdentity,
        profilesRepo: noopProfiles,
      })
      await app.ready()
      try {
        const res = await app.inject({ method: 'GET', url: '/healthz' })
        expect(res.headers['strict-transport-security']).toBeUndefined()
      } finally {
        await app.close()
      }
    }
  })

  it('sets HSTS in production', async () => {
    const app = await buildApp(testEnv({ NODE_ENV: 'production' }), {
      db: createMockDb({}),
      identityAdmin: noopIdentity,
      profilesRepo: noopProfiles,
    })
    await app.ready()
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['strict-transport-security']).toMatch(/max-age=15552000/)
      expect(res.headers['strict-transport-security']).not.toMatch(/includesubdomains/i)
      expect(res.headers['strict-transport-security']).not.toMatch(/preload/i)
    } finally {
      await app.close()
    }
  })
})
