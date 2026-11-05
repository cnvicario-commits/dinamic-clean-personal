/**
 * Classifies a database or Supabase URL before a test process may use it.
 * `npm run dev` does not import this module.
 */

export const BLOCKED_CLOUD_PROJECT_REFS = [
  'edruejzwwnixsjsadbgb',
  'biectbcujabpjhinouil',
] as const

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export type ConnectionVerdict = 'empty' | 'local' | 'cloud' | 'ambiguous'

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    return null
  }
}

function isHostedSupabase(host: string): boolean {
  return (
    host === 'supabase.co' ||
    host === 'supabase.com' ||
    host === 'supabase.in' ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.com') ||
    host.endsWith('.supabase.in') ||
    host.endsWith('.pooler.supabase.com') ||
    host.includes('pooler.supabase')
  )
}

/** Fail closed: only loopback hosts are disposable. Hosted Supabase and unknown hosts are not. */
export function classifyConnectionTarget(raw: string | undefined | null): ConnectionVerdict {
  const value = (raw ?? '').trim()
  if (!value) return 'empty'
  const lower = value.toLowerCase()
  if (BLOCKED_CLOUD_PROJECT_REFS.some((ref) => lower.includes(ref))) return 'cloud'
  const host = hostOf(value)
  if (!host) return 'ambiguous'
  if (LOCAL_HOSTS.has(host)) return 'local'
  if (isHostedSupabase(host)) return 'cloud'
  return 'ambiguous'
}

export function refuseNonLocalDatabaseInTest(
  connectionString: string | undefined,
  nodeEnv: string,
): void {
  if (nodeEnv !== 'test') return
  const verdict = classifyConnectionTarget(connectionString)
  if (verdict !== 'local') {
    throw new Error(`Refusing ${verdict} database target in the test process`)
  }
}
