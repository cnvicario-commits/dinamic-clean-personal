/**
 * Test-process guard. The API dev server does not load this module.
 * Integration is allowed only against a loopback Supabase CLI / Postgres.
 * Hosted project refs are refused even when the URL is otherwise local.
 */

import pg from 'pg'
import {
  classifyConnectionTarget,
  refuseNonLocalDatabaseInTest,
} from '../src/infrastructure/db/connection-target.js'

export {
  BLOCKED_CLOUD_PROJECT_REFS,
  classifyConnectionTarget,
  refuseNonLocalDatabaseInTest,
} from '../src/infrastructure/db/connection-target.js'

export const CONNECTION_ENV_KEYS = [
  'DATABASE_URL',
  'MIGRATIONS_DATABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'PHASE4A_ADMIN_DATABASE_URL',
  'SOURCE_DATABASE_URL',
  'TARGET_DATABASE_URL',
  'RESTORE_TARGET_DB_URL',
] as const

export function isSupabaseIntegrationEnabled(): boolean {
  return process.env.RUN_SUPABASE_INTEGRATION === '1'
}

export function extractSupabaseProjectRefFromUrl(url: string): string | null {
  const match = String(url).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return match?.[1]?.toLowerCase() ?? null
}

/** Pooler user `postgres.<ref>` / `dinamic_api.<ref>` or `@db.<ref>.supabase.co` host. */
export function extractProjectRefFromDatabaseUrl(databaseUrl: string): string | null {
  const raw = String(databaseUrl)
  const userMatch = raw.match(/postgresql:\/\/[^:@]*?\.([a-z0-9]+)[:@]/i)
  if (userMatch?.[1]) return userMatch[1].toLowerCase()
  const hostMatch = raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i)
  if (hostMatch?.[1]) return hostMatch[1].toLowerCase()
  const poolerMatch = raw.match(/\.([a-z0-9]+)\.pooler\.supabase/i)
  if (poolerMatch?.[1]) return poolerMatch[1].toLowerCase()
  return null
}

export type TestTargetAssertOptions = {
  requireJwt?: boolean
}

/**
 * Integration suites may run only when the operator opted in and every
 * connection variable is a loopback target. Hosted Supabase is refused.
 */
export function assertDinamicCleanTestTarget(opts: TestTargetAssertOptions = {}): void {
  if (process.env.RUN_SUPABASE_INTEGRATION !== '1') {
    throw new Error('Integration requires RUN_SUPABASE_INTEGRATION=1')
  }
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Integration requires NODE_ENV=test')
  }
  const compatibilityTarget = (process.env.DB_COMPATIBILITY_TARGET ?? '').trim().toLowerCase()
  if (compatibilityTarget !== 'simulation') {
    throw new Error('Integration requires DB_COMPATIBILITY_TARGET=simulation')
  }

  for (const key of CONNECTION_ENV_KEYS) {
    const verdict = classifyConnectionTarget(process.env[key])
    if (verdict === 'empty') continue
    if (verdict !== 'local') {
      throw new Error(`Refusing ${verdict} ${key} in the test process`)
    }
  }

  if (
    classifyConnectionTarget(process.env.SUPABASE_URL) !== 'local' ||
    classifyConnectionTarget(process.env.DATABASE_URL) !== 'local'
  ) {
    throw new Error('Simulation integration writes require a local Supabase URL and database')
  }

  if (opts.requireJwt && !(process.env.POSTGREST_TEST_USER_JWT ?? '').trim()) {
    throw new Error('POSTGREST_TEST_USER_JWT is required for PostgREST negative tests')
  }
}

/**
 * Default `npm test`: drop hosted or unproven connection variables so suites
 * cannot inherit a cloud shell. Explicit integration fails closed instead.
 */
export function installTestProcessGuard(): void {
  if (isSupabaseIntegrationEnabled()) {
    assertDinamicCleanTestTarget()
    return
  }
  for (const key of CONNECTION_ENV_KEYS) {
    const verdict = classifyConnectionTarget(process.env[key])
    if (verdict === 'cloud' || verdict === 'ambiguous') {
      delete process.env[key]
    }
  }
}

let poolGuardInstalled = false

/** Every `new pg.Pool` in this test worker must pass the same local-only rule. */
export function installPgPoolGuard(): void {
  if (poolGuardInstalled) return
  poolGuardInstalled = true
  const original = pg.Pool
  const GuardedPool = class extends original {
    constructor(...args: ConstructorParameters<typeof original>) {
      const config = args[0]
      const connectionString =
        typeof config?.connectionString === 'string'
          ? config.connectionString
          : config?.host
            ? `postgresql://${config.host}`
            : undefined
      refuseNonLocalDatabaseInTest(connectionString, 'test')
      super(...args)
    }
  }
  pg.Pool = GuardedPool as unknown as typeof pg.Pool
}
