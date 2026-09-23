import { SignJWT } from 'jose'
import { createSecretKey } from 'node:crypto'
import type { Db } from '../src/infrastructure/db/pool.js'
import type { Phase2dCapabilityResult } from '../src/infrastructure/db/phase2d-capabilities.js'
import type { Phase3aCapabilityResult } from '../src/infrastructure/db/phase3a-capabilities.js'
import type { Env } from '../src/config/env.js'
import type pg from 'pg'

export const TEST_JWT_SECRET = 'test-hs256-secret-for-vitest-only'
export const TEST_SUPABASE_URL = 'https://example.supabase.co'
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3001,
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db',
    SUPABASE_URL: TEST_SUPABASE_URL,
    SUPABASE_JWT_SECRET: TEST_JWT_SECRET,
    SHUTDOWN_TIMEOUT_MS: 10_000,
    TRUST_PROXY_CIDRS: [],
    RATE_LIMIT_ENABLED: false,
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_GENERAL_MAX: 600,
    RATE_LIMIT_SENSITIVE_MAX: 20,
    ...overrides,
  }
}

export async function signAccessToken(opts: {
  sub: string
  email?: string
  /** Supabase assurance level claim. Defaults to aal2 so privileged admin tests pass MFA gate. */
  aal?: 'aal1' | 'aal2'
  /** Shift `iat`/`exp` by N seconds (tests for tokens_valid_after). */
  issuedAtOffsetSeconds?: number
  secret?: string
  issuer?: string
  audience?: string
  expiresIn?: string | number
}): Promise<string> {
  const secret = opts.secret ?? TEST_JWT_SECRET
  const key = createSecretKey(Buffer.from(secret))
  const nowSec = Math.floor(Date.now() / 1000) + (opts.issuedAtOffsetSeconds ?? 0)
  let builder = new SignJWT({
    email: opts.email ?? 'user@example.com',
    role: 'authenticated',
    aal: opts.aal ?? 'aal2',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.sub)
    .setIssuer(opts.issuer ?? TEST_ISSUER)
    .setAudience(opts.audience ?? 'authenticated')
    .setIssuedAt(nowSec)

  if (opts.expiresIn !== undefined) {
    builder = builder.setExpirationTime(opts.expiresIn)
  } else {
    builder = builder.setExpirationTime(nowSec + 3600)
  }

  return builder.sign(key)
}

type QueryHandler = (
  text: string,
  params?: unknown[],
) => Promise<pg.QueryResult<pg.QueryResultRow>>

export function createMockDb(options: {
  isReady?: () => Promise<boolean>
  query?: QueryHandler
  close?: () => Promise<void>
  checkPhase2dProfilesCapabilities?: () => Promise<Phase2dCapabilityResult>
  checkPhase3aCapabilities?: () => Promise<Phase3aCapabilityResult>
}): Db {
  return {
    pool: {} as pg.Pool,
    query: options.query ?? (async () => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] })),
    close: options.close ?? (async () => undefined),
    isReady: options.isReady ?? (async () => true),
    checkPhase2dProfilesCapabilities:
      options.checkPhase2dProfilesCapabilities ?? (async () => ({ ok: true })),
    checkPhase3aCapabilities:
      options.checkPhase3aCapabilities ?? (async () => ({ ok: true, currentUser: 'dinamic_api' })),
  }
}

/** Stub perfiles + optional auth.users for authenticateRequest. */
export function createProfileStubDb(opts: {
  profile?: { id: string; nombre_completo: string | null; rol: string } | null
  authUser?: { banned_until: string | null; deleted_at: string | null } | null | 'unavailable'
  isReady?: () => Promise<boolean>
  checkPhase2dProfilesCapabilities?: () => Promise<Phase2dCapabilityResult>
  checkPhase3aCapabilities?: () => Promise<Phase3aCapabilityResult>
}): Db {
  return createMockDb({
    isReady: opts.isReady,
    checkPhase2dProfilesCapabilities: opts.checkPhase2dProfilesCapabilities,
    checkPhase3aCapabilities: opts.checkPhase3aCapabilities,
    async query(text, params) {
      const sql = text.replace(/\s+/g, ' ').toLowerCase()
      if (sql.includes('from public.perfiles')) {
        if (!opts.profile) {
          return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }
        }
        return {
          rows: [opts.profile],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      }
      if (sql.includes('from auth.users')) {
        if (opts.authUser === 'unavailable') {
          throw new Error('permission denied for table users')
        }
        if (opts.authUser === null || opts.authUser === undefined) {
          return {
            rows: [{ banned_until: null, deleted_at: null }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          }
        }
        return {
          rows: [opts.authUser],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      }
      if (sql.includes('from public.empleados') && sql.includes('count(*)')) {
        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      }
      if (sql.includes('from public.empleados')) {
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }
      }
      void params
      return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }
    },
  })
}
