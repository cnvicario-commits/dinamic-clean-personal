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

describe('phase2f cors', () => {
  it('reflects allowed origin; unknown origin has no ACAO; OPTIONS allowed', async () => {
    const app = await buildApp(
      testEnv({ CORS_ORIGIN: 'http://localhost:3000,https://app.example.com' }),
      {
        db: createMockDb({}),
        identityAdmin: noopIdentity,
        profilesRepo: noopProfiles,
      },
    )
    await app.ready()
    try {
      const allowed = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: 'http://localhost:3000' },
      })
      expect(allowed.statusCode).toBe(200)
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(allowed.headers['access-control-allow-credentials']).toBe('true')

      const denied = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: { origin: 'https://evil.example' },
      })
      expect(denied.statusCode).toBe(200)
      expect(denied.headers['access-control-allow-origin']).toBeUndefined()

      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/healthz',
        headers: {
          origin: 'https://app.example.com',
          'access-control-request-method': 'GET',
        },
      })
      expect(preflight.statusCode).toBe(204)
      expect(preflight.headers['access-control-allow-origin']).toBe('https://app.example.com')
      expect(preflight.headers['access-control-allow-credentials']).toBe('true')
    } finally {
      await app.close()
    }
  })
})
