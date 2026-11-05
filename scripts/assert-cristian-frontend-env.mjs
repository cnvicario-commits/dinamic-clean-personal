/**
 * Rejects a Cristian frontend build or process that points at production.
 * NEXT_PUBLIC_* values are fixed when the image is built. This script never prints them.
 */
import fs from 'node:fs'
import net from 'node:net'

const TEST_REF = 'edruejzwwnixsjsadbgb'
const PRODUCTION_REF = 'biectbcujabpjhinouil'
const INTERNAL_API = 'http://dinamic-clean-cristian-api:3001'
const CRISTIAN_HTTP_API = 'http://170.239.85.196:3006'
const FORBIDDEN = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'MIGRATIONS_DATABASE_URL',
  'SUPABASE_JWT_SECRET',
  'POSTGRES_PASSWORD',
  'SUPABASE_SECRET_KEY',
]

export function cristianFrontendUsesStandalone(env) {
  return env.CRISTIAN_FRONTEND_BUILD === '1'
}

function fail(reason) {
  return { ok: false, reason }
}

function pass() {
  return { ok: true, reason: '' }
}

function jwtRole(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : undefined
  } catch {
    return undefined
  }
}

function reservedHost(host, mode) {
  const name = host.toLowerCase()
  if (name === 'localhost' || name === '127.0.0.1' || name === '::1' || name === '0.0.0.0') return true
  if (name.endsWith('.local') || name.endsWith('.localhost') || name.endsWith('.vercel.app')) return true
  if (
    name === 'example.com' ||
    name === 'example.org' ||
    name === 'example.net' ||
    name.endsWith('.example.com') ||
    name.endsWith('.example.org') ||
    name.endsWith('.example.net')
  ) {
    return true
  }
  if (name.includes(PRODUCTION_REF)) return true
  if (mode === 'deploy' && (name.endsWith('.invalid') || name.endsWith('.test'))) return true
  return false
}

function assertPublicSupabase(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return 'supabase-url-ambiguous'
  }
  if (url.protocol !== 'https:') return 'supabase-url-not-https'
  if (url.username || url.password) return 'supabase-url-has-credentials'
  if (url.hostname.toLowerCase() !== `${TEST_REF}.supabase.co`) return 'supabase-url-not-test'
  if (url.pathname !== '/' && url.pathname !== '') return 'supabase-url-path'
  if (value.toLowerCase().includes(PRODUCTION_REF)) return 'supabase-url-production'
  return null
}

function isExactCristianHttpApi(url) {
  return (
    url.protocol === 'http:' &&
    url.hostname === '170.239.85.196' &&
    url.port === '3006' &&
    (url.pathname === '/' || url.pathname === '') &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  )
}

function assertBrowserApi(value, mode) {
  let url
  try {
    url = new URL(value)
  } catch {
    return 'browser-api-url-ambiguous'
  }
  if (url.username || url.password) return 'browser-api-url-has-credentials'
  if (value === CRISTIAN_HTTP_API && isExactCristianHttpApi(url)) return null
  if (url.protocol !== 'https:') return 'browser-api-url-not-https'
  if (url.port === '3005' || url.port === '3006') return 'browser-api-url-reserved-port'
  const host = url.hostname.toLowerCase()
  if (net.isIP(host)) return 'browser-api-url-is-ip'
  if (!host.includes('.')) return 'browser-api-url-not-public'
  if (reservedHost(host, mode)) return 'browser-api-url-not-deployable'
  if (value.toLowerCase().includes(PRODUCTION_REF)) return 'browser-api-url-production'
  return null
}

function assertAnon(value) {
  const key = value.trim()
  if (!key) return 'missing-anon-key'
  if (key.toLowerCase().includes(PRODUCTION_REF) || key.toLowerCase().includes('service_role')) {
    return 'anon-key-is-secret'
  }
  if (key.startsWith('sb_secret_')) return 'anon-key-is-secret'
  const role = jwtRole(key)
  if (role === 'service_role') return 'anon-key-is-secret'
  if (role === 'anon') return null
  if (key.startsWith('sb_publishable_') && key.length >= 20) return null
  return 'anon-key-unrecognized'
}

export function assessCristianFrontendEnv(env, mode, manifest) {
  if (mode !== 'build' && mode !== 'runtime' && mode !== 'deploy') return fail('unknown-mode')
  if ((env.APP_DEPLOYMENT_ENV ?? '').trim() !== 'cristian-pruebas') return fail('deployment-env')
  if (mode !== 'deploy' && (env.NODE_ENV ?? '').trim() !== 'production') return fail('node-env')
  if (mode === 'build' && env.CRISTIAN_FRONTEND_BUILD !== '1') return fail('standalone-build-flag')
  if (!/^[0-9a-f]{7,40}$/.test((env.APP_RELEASE_SHA ?? '').trim())) return fail('release-sha')
  for (const name of FORBIDDEN) {
    if ((env[name] ?? '').trim() !== '') return fail(`forbidden-${name}`)
  }
  const supabase = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const browserApi = (env.NEXT_PUBLIC_API_URL ?? '').trim()
  const supabaseError = assertPublicSupabase(supabase)
  if (supabaseError) return fail(supabaseError)
  const browserError = assertBrowserApi(browserApi, mode)
  if (browserError) return fail(browserError)
  const anonError = assertAnon(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
  if (anonError) return fail(anonError)
  const serverApi = (env.API_URL ?? '').trim()
  if (serverApi && serverApi !== INTERNAL_API && serverApi !== browserApi) return fail('server-api-url-not-allowed')
  if (mode === 'runtime') {
    if (!manifest || typeof manifest !== 'object') return fail('missing-manifest')
    if (manifest.anonKey || manifest.serviceRole || manifest.databaseUrl) return fail('manifest-has-secret')
    if (manifest.supabaseUrl !== supabase) return fail('public-supabase-url-drift')
    if (manifest.apiUrl !== browserApi) return fail('public-api-url-drift')
    if (manifest.release !== env.APP_RELEASE_SHA.trim()) return fail('release-drift')
  }
  return pass()
}

export function writeCristianFrontendManifest(filePath, env) {
  const manifest = {
    supabaseUrl: (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
    apiUrl: (env.NEXT_PUBLIC_API_URL ?? '').trim(),
    release: (env.APP_RELEASE_SHA ?? '').trim(),
  }
  fs.writeFileSync(filePath, `${JSON.stringify(manifest)}\n`)
}

const invokedDirectly = process.argv[1]?.endsWith('assert-cristian-frontend-env.mjs')
if (invokedDirectly) {
  const mode = process.argv[2]
  if (mode === 'write-manifest') {
    writeCristianFrontendManifest(process.argv[3] || 'cristian-frontend-manifest.json', process.env)
  } else {
    let manifest
    if (mode === 'runtime') {
      manifest = JSON.parse(fs.readFileSync(process.argv[3] || 'cristian-frontend-manifest.json', 'utf8'))
    }
    const result = assessCristianFrontendEnv(process.env, mode, manifest)
    if (!result.ok) {
      console.error(`CRISTIAN_FRONTEND_REJECTED ${result.reason}`)
      process.exit(1)
    }
    console.log('CRISTIAN_FRONTEND_ENV_OK')
  }
}
