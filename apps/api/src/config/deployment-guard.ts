/**
 * Startup identity for the published Cristian API.
 * Runs only when APP_DEPLOYMENT_ENV=cristian-pruebas. Local development and
 * the production container leave that variable unset and are not affected.
 * There is no flag that disables these checks.
 */

const TEST_REF = 'edruejzwwnixsjsadbgb'
const PRODUCTION_REF = 'biectbcujabpjhinouil'
const CRISTIAN_HTTP_FRONTEND = 'http://170.239.85.196:8086'
const WIDE_PROXIES = new Set(['0.0.0.0/0', '0.0.0.0', '::/0', '::'])

export class CristianDeploymentRejected extends Error {
  constructor(reason: string) {
    super(`CRISTIAN_DEPLOYMENT_REJECTED ${reason}`)
    this.name = 'CristianDeploymentRejected'
  }
}

function reject(reason: string): never {
  throw new CristianDeploymentRejected(reason)
}

function parsedUrl(value: string, label: string): URL {
  try {
    return new URL(value)
  } catch {
    reject(`${label} is ambiguous`)
  }
}

function assertNoProduction(value: string, label: string): void {
  if (value.toLowerCase().includes(PRODUCTION_REF)) reject(`${label} points at production`)
}

function databaseRole(url: URL): string {
  const user = decodeURIComponent(url.username || '').toLowerCase()
  return user.split('.')[0] ?? ''
}

function assertTestDatabase(raw: string): void {
  assertNoProduction(raw, 'DATABASE_URL')
  const url = parsedUrl(raw, 'DATABASE_URL')
  const host = url.hostname.toLowerCase()
  const role = databaseRole(url)
  const database = url.pathname.replace(/^\//, '')
  const direct = host === `db.${TEST_REF}.supabase.co`
  const pooler = host.endsWith('.pooler.supabase.com') && url.username.toLowerCase().includes(TEST_REF)
  if (!direct && !pooler) reject('DATABASE_URL host is not Supabase Test')
  if (database !== 'postgres') reject('DATABASE_URL database is not postgres')
  if (role !== 'dinamic_api') reject('DATABASE_URL role must be dinamic_api')
}

function assertTestSupabase(raw: string): void {
  assertNoProduction(raw, 'SUPABASE_URL')
  const url = parsedUrl(raw, 'SUPABASE_URL')
  if (url.protocol !== 'https:') reject('SUPABASE_URL must use https')
  if (url.username || url.password) reject('SUPABASE_URL must not carry credentials')
  if (url.hostname.toLowerCase() !== `${TEST_REF}.supabase.co`) reject('SUPABASE_URL host is not Supabase Test')
  if (url.pathname !== '' && url.pathname !== '/') reject('SUPABASE_URL path is unexpected')
}

function assertCors(raw: string | undefined): void {
  const origins = (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (origins.length === 0) reject('CORS_ORIGIN is empty')
  if (origins.some((origin) => origin === '*' || origin.includes('*'))) {
    reject('CORS_ORIGIN wildcard is not allowed')
  }
  if (origins.includes(CRISTIAN_HTTP_FRONTEND)) {
    if (origins.length !== 1) reject('CORS_ORIGIN http publication must be the only origin')
    return
  }
  for (const origin of origins) {
    assertNoProduction(origin, 'CORS_ORIGIN')
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      reject('CORS_ORIGIN is not an absolute URL')
    }
    if (url.username || url.password || url.search || url.hash) reject('CORS_ORIGIN is ambiguous')
    if (url.pathname !== '/' && url.pathname !== '') reject('CORS_ORIGIN path is unexpected')
    if (url.protocol !== 'https:') reject('CORS_ORIGIN must use https or the Cristian HTTP origin')
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      reject('CORS_ORIGIN must not be loopback on the published demo')
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
      reject('CORS_ORIGIN must not use an address other than the Cristian HTTP origin')
    }
  }
}

function assertProxy(raw: string | undefined): void {
  const entries = (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (entries.length === 0) reject('TRUST_PROXY_CIDRS is required behind Nginx')
  for (const entry of entries) {
    if (WIDE_PROXIES.has(entry.toLowerCase())) reject('TRUST_PROXY_CIDRS is too wide')
  }
}

export function assertCristianPruebasDeployment(raw: NodeJS.ProcessEnv): void {
  if ((raw.APP_DEPLOYMENT_ENV ?? '').trim() !== 'cristian-pruebas') {
    reject('APP_DEPLOYMENT_ENV is not cristian-pruebas')
  }
  if ((raw.NODE_ENV ?? '').trim() !== 'production') {
    reject('NODE_ENV must be production')
  }
  if ((raw.EXPECTED_SUPABASE_PROJECT_REF ?? '').trim().toLowerCase() !== TEST_REF) {
    reject('EXPECTED_SUPABASE_PROJECT_REF must be the Test project')
  }
  if ((raw.MIGRATIONS_DATABASE_URL ?? '').trim() !== '') {
    reject('MIGRATIONS_DATABASE_URL must be empty at runtime')
  }
  if (!(raw.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()) {
    reject('SUPABASE_SERVICE_ROLE_KEY is required')
  }
  if (!/^[0-9a-f]{7,40}$/.test((raw.APP_RELEASE_SHA ?? '').trim())) {
    reject('APP_RELEASE_SHA must be a git sha')
  }
  assertTestSupabase((raw.SUPABASE_URL ?? '').trim())
  assertTestDatabase((raw.DATABASE_URL ?? '').trim())
  assertCors(raw.CORS_ORIGIN)
  assertProxy(raw.TRUST_PROXY_CIDRS)
}
