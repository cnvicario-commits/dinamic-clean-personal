import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const apiRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(apiRoot, '../..')
for (const path of [
  resolve(apiRoot, '.env'),
  resolve(apiRoot, '.env.local'),
  resolve(apiRoot, '.env.compose.local'),
  resolve(repoRoot, '.env'),
  resolve(repoRoot, '.env.local'),
]) {
  loadDotenv({ path })
}
if (!process.env.SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}
process.env.RUN_SUPABASE_INTEGRATION = '1'
process.env.NODE_ENV = 'test'

const required = [
  'EXPECTED_SUPABASE_TEST_PROJECT_REF',
  'SUPABASE_URL',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CORS_ORIGIN',
  'SUPABASE_ANON_KEY',
]
const missing = required.filter((k) => !(process.env[k] ?? '').trim())
if (missing.length) {
  console.error('MISSING_ENV', missing.join(','))
  process.exit(2)
}
console.log('INTEGRATION_ENV_OK', new URL(process.env.SUPABASE_URL).host)

const args = process.argv.slice(2)
const child = spawn('npx', ['vitest', 'run', ...args], {
  stdio: 'inherit',
  env: process.env,
  cwd: apiRoot,
})
child.on('exit', (code) => process.exit(code ?? 1))
