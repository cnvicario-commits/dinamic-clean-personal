/**
 * Fail-closed check for a destructive restore.
 * Only a loopback URL that does not name a hosted project is accepted.
 * Confirmation variables are ignored. This module never connects.
 */

const BLOCKED_REFS = ['edruejzwwnixsjsadbgb', 'biectbcujabpjhinouil']
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export function classifyDisposableTarget(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return 'empty'
  const lower = value.toLowerCase()
  if (BLOCKED_REFS.some((ref) => lower.includes(ref))) return 'cloud'
  let host = ''
  try {
    host = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    return 'ambiguous'
  }
  if (!host) return 'ambiguous'
  if (LOCAL_HOSTS.has(host)) return 'local'
  if (
    host === 'supabase.co' ||
    host === 'supabase.com' ||
    host === 'supabase.in' ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.com') ||
    host.endsWith('.supabase.in') ||
    host.includes('pooler.supabase')
  ) {
    return 'cloud'
  }
  return 'ambiguous'
}

const invokedDirectly = process.argv[1]?.endsWith('disposable-target.mjs')
if (invokedDirectly) {
  const verdict = classifyDisposableTarget(process.argv[2])
  if (verdict !== 'local') {
    console.error(`RESTORE_TARGET_REJECTED ${verdict}`)
    process.exit(1)
  }
}
