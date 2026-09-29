import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { spawn,spawnSync } from 'node:child_process'

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
if(process.env.USE_LOCAL_SUPABASE==='1'){
  const status=spawnSync('npx',['supabase','status','-o','env'],{cwd:repoRoot,encoding:'utf8'})
  if(status.status!==0){console.error('LOCAL_SUPABASE_STATUS_FAILED');process.exit(status.status??2)}
  const local=Object.fromEntries(status.stdout.split('\n').flatMap(line=>{const match=line.match(/^([A-Z_]+)="?(.*?)"?$/);return match?[[match[1],match[2]]]:[]}))
  process.env.SUPABASE_URL=local.API_URL
  process.env.SUPABASE_ANON_KEY=local.ANON_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY=local.SERVICE_ROLE_KEY
  process.env.SUPABASE_JWT_SECRET=local.JWT_SECRET
  process.env.DATABASE_URL='postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres?options=-c%20role%3Ddinamic_api'
  process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF='local'
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
