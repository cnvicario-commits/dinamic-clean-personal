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

const injectPeer = { remoteAddress: '127.0.0.1' as const }

describe('phase2f trust proxy', () => {
  it('DIRECT (empty CIDRS): spoofed X-Forwarded-For does not split rate-limit buckets', async () => {
    const app = await buildApp(
      testEnv({
        TRUST_PROXY_CIDRS: [],
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_GENERAL_MAX: 2,
        RATE_LIMIT_WINDOW_MS: 60_000,
      }),
      {
        db: createMockDb({}),
        identityAdmin: noopIdentity,
        profilesRepo: noopProfiles,
      },
    )
    await app.ready()
    try {
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '203.0.113.10' },
          })
        ).statusCode,
      ).toBe(401)
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '198.51.100.20' },
          })
        ).statusCode,
      ).toBe(401)
      const limited = await app.inject({
        ...injectPeer,
        method: 'GET',
        url: '/v1/me',
        headers: { 'x-forwarded-for': '192.0.2.30' },
      })
      expect(limited.statusCode).toBe(429)
      expect(limited.json()).toMatchObject({ code: 'rate_limit_exceeded' })
    } finally {
      await app.close()
    }
  })

  it('TRUSTED: TRUST_PROXY_CIDRS includes inject peer; XFF splits rate-limit buckets', async () => {
    const app = await buildApp(
      testEnv({
        TRUST_PROXY_CIDRS: ['127.0.0.1'],
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_GENERAL_MAX: 1,
        RATE_LIMIT_WINDOW_MS: 60_000,
      }),
      {
        db: createMockDb({}),
        identityAdmin: noopIdentity,
        profilesRepo: noopProfiles,
      },
    )
    await app.ready()
    try {
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '203.0.113.10' },
          })
        ).statusCode,
      ).toBe(401)

      // Same client IP from XFF → limited
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '203.0.113.10' },
          })
        ).statusCode,
      ).toBe(429)

      // Different client IP from XFF → separate bucket (not limited)
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '198.51.100.20' },
          })
        ).statusCode,
      ).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('UNTRUSTED: CIDR does not match inject peer; spoofed XFF does not split buckets', async () => {
    const app = await buildApp(
      testEnv({
        TRUST_PROXY_CIDRS: ['10.255.255.1'],
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_GENERAL_MAX: 2,
        RATE_LIMIT_WINDOW_MS: 60_000,
      }),
      {
        db: createMockDb({}),
        identityAdmin: noopIdentity,
        profilesRepo: noopProfiles,
      },
    )
    await app.ready()
    try {
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '203.0.113.10' },
          })
        ).statusCode,
      ).toBe(401)
      expect(
        (
          await app.inject({
            ...injectPeer,
            method: 'GET',
            url: '/v1/me',
            headers: { 'x-forwarded-for': '198.51.100.20' },
          })
        ).statusCode,
      ).toBe(401)
      const limited = await app.inject({
        ...injectPeer,
        method: 'GET',
        url: '/v1/me',
        headers: { 'x-forwarded-for': '192.0.2.30' },
      })
      expect(limited.statusCode).toBe(429)
    } finally {
      await app.close()
    }
  })
})
