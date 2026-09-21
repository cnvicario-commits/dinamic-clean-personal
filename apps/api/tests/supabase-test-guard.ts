/**
 * Hard guardrails for destructive Supabase/Postgres integration suites.
 * Never logs secrets, JWTs, passwords, or full DATABASE_URL.
 */

export function extractSupabaseProjectRefFromUrl(url: string): string | null {
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  if (m?.[1]) return m[1].toLowerCase()
  return null
}

/** Pooler user `postgres.<ref>` or host containing project ref. */
export function extractProjectRefFromDatabaseUrl(databaseUrl: string): string | null {
  const userMatch = databaseUrl.match(/postgresql:\/\/[^:@]*?\.([a-z0-9]+)[:@]/i)
  if (userMatch?.[1]) return userMatch[1].toLowerCase()
  const hostMatch = databaseUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/i)
  if (hostMatch?.[1]) return hostMatch[1].toLowerCase()
  const poolerMatch = databaseUrl.match(/\.([a-z0-9]+)\.pooler\.supabase/i)
  if (poolerMatch?.[1]) return poolerMatch[1].toLowerCase()
  return null
}

export type TestTargetAssertOptions = {
  requireJwt?: boolean
}

/**
 * Abort before any write if TEST target is not unequivocally identified.
 */
export function assertDinamicCleanTestTarget(opts: TestTargetAssertOptions = {}): void {
  if (process.env.RUN_SUPABASE_INTEGRATION !== '1') {
    throw new Error('Integration requires RUN_SUPABASE_INTEGRATION=1')
  }
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Integration requires NODE_ENV=test')
  }

  const expected = (process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF ?? '').trim().toLowerCase()
  if (!expected) {
    throw new Error('EXPECTED_SUPABASE_TEST_PROJECT_REF is required for integration writes')
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? ''
  const actualFromUrl = extractSupabaseProjectRefFromUrl(supabaseUrl)
  if (!actualFromUrl) {
    throw new Error('Could not parse project ref from SUPABASE_URL')
  }
  if (actualFromUrl !== expected) {
    throw new Error('SUPABASE_URL project ref does not match EXPECTED_SUPABASE_TEST_PROJECT_REF')
  }

  const databaseUrl = process.env.DATABASE_URL ?? ''
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }
  const dbRef = extractProjectRefFromDatabaseUrl(databaseUrl)
  if (dbRef && dbRef !== expected) {
    throw new Error('DATABASE_URL project ref does not match EXPECTED_SUPABASE_TEST_PROJECT_REF')
  }

  if (opts.requireJwt && !(process.env.POSTGREST_TEST_USER_JWT ?? '').trim()) {
    throw new Error('POSTGREST_TEST_USER_JWT is required for PostgREST negative tests')
  }

  // No escape hatch for unmarked / production-looking hosts
  if (/prod/i.test(supabaseUrl) && !/test/i.test(supabaseUrl)) {
    throw new Error('Refusing Supabase URL that looks like production')
  }
}
