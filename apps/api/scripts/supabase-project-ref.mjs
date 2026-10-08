/** Shared Supabase project ref parsing for deployment gates (mirrors tests/supabase-test-guard.ts). */

export function extractSupabaseProjectRefFromUrl(url) {
  const m = String(url).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m?.[1]?.toLowerCase() ?? null
}

/** Pooler user `postgres.<ref>` / `dinamic_api.<ref>` or `@db.<ref>.supabase.co` host. */
export function extractProjectRefFromDatabaseUrl(databaseUrl) {
  const raw = String(databaseUrl)
  const userMatch = raw.match(/postgresql:\/\/[^:@]*?\.([a-z0-9]+)[:@]/i)
  if (userMatch?.[1]) return userMatch[1].toLowerCase()
  const hostMatch = raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i)
  if (hostMatch?.[1]) return hostMatch[1].toLowerCase()
  const poolerMatch = raw.match(/\.([a-z0-9]+)\.pooler\.supabase/i)
  if (poolerMatch?.[1]) return poolerMatch[1].toLowerCase()
  return null
}
