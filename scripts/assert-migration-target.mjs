/**
 * Decides whether a forward-migration URL may be used.
 * Prints only a class, never the URL. Does not connect.
 *
 * Cloud is accepted only when the URL is the shared test project and the
 * host matches that project. Loopback is accepted only when the caller sets
 * DINAMIC_MIGRATION_TARGET=disposable-local. Production is always rejected.
 */

const PROD = 'biectbcujabpjhinouil'
const TEST = 'edruejzwwnixsjsadbgb'
const LOCAL = new Set(['localhost', '127.0.0.1', '::1'])

export function assessMigrationUrl(raw, allowDisposableLocal = false) {
  const value = String(raw ?? '').trim()
  if (!value) return { ok: false, reason: 'empty' }
  const lower = value.toLowerCase()
  if (lower.includes(PROD)) return { ok: false, reason: 'production' }
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, reason: 'ambiguous' }
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const user = decodeURIComponent(parsed.username || '').toLowerCase()
  const database = parsed.pathname.replace(/^\//, '')
  if (!host || !database) return { ok: false, reason: 'ambiguous' }

  if (lower.includes(TEST)) {
    const direct = host === `db.${TEST}.supabase.co`
    const pooler = host.endsWith('.pooler.supabase.com') && user.includes(TEST)
    if (!direct && !pooler) return { ok: false, reason: 'test-ref-unexpected-host' }
    if (database !== 'postgres') return { ok: false, reason: 'unexpected-database' }
    return {
      ok: true,
      kind: 'test-cloud',
      hostClass: direct ? 'direct' : 'pooler',
      role: user.split('.')[0] || 'unknown',
      port: parsed.port || '5432',
    }
  }

  if (LOCAL.has(host)) {
    if (!allowDisposableLocal) return { ok: false, reason: 'local-not-marked-disposable' }
    return { ok: true, kind: 'disposable-local', hostClass: 'loopback', role: user || 'unknown', port: parsed.port || '5432' }
  }

  if (
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.com') ||
    host.endsWith('.supabase.in') ||
    host.includes('pooler.supabase')
  ) {
    return { ok: false, reason: 'unidentified-cloud' }
  }
  return { ok: false, reason: 'ambiguous' }
}

const invokedDirectly = process.argv[1]?.endsWith('assert-migration-target.mjs')
if (invokedDirectly) {
  const allow = process.env.DINAMIC_MIGRATION_TARGET === 'disposable-local'
  const result = assessMigrationUrl(process.argv[2], allow)
  if (!result.ok) {
    console.error(`MIGRATION_TARGET_REJECTED ${result.reason}`)
    process.exit(1)
  }
  console.log(`MIGRATION_TARGET ${result.kind}`)
  console.log(`host_class ${result.hostClass}`)
  console.log(`role ${result.role}`)
  console.log(`port ${result.port}`)
}
