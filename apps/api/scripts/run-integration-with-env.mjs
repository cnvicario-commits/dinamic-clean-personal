#!/usr/bin/env node
/**
 * Run API integration tests against a local Supabase CLI stack only.
 * Refuses inherited cloud URLs. Does not load apps/api/.env.
 *
 *   USE_LOCAL_SUPABASE=1 node scripts/run-integration-with-env.mjs tests/http.integration.test.ts
 */
import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { classifyDisposableTarget } from '../../../scripts/disposable-target.mjs'

if (process.env.USE_LOCAL_SUPABASE !== '1') {
  console.error('LOCAL_SUPABASE_REQUIRED set USE_LOCAL_SUPABASE=1 after supabase start')
  process.exit(2)
}

const apiRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(apiRoot, '../..')
const status = spawnSync('npx', ['supabase', 'status', '-o', 'env'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
if (status.status !== 0) {
  console.error('LOCAL_SUPABASE_STATUS_FAILED')
  process.exit(status.status ?? 2)
}

const local = Object.fromEntries(
  status.stdout.split('\n').flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/)
    return match ? [[match[1], match[2]]] : []
  }),
)

function localUrl(value, label) {
  if (classifyDisposableTarget(value) !== 'local') {
    console.error(`LOCAL_SUPABASE_URL_NOT_LOOPBACK ${label}`)
    process.exit(2)
  }
  return value
}

const apiUrl = localUrl(local.API_URL, 'API_URL')
const dbUrl = localUrl(process.env.DINAMIC_LOCAL_DATABASE_URL || local.DB_URL || local.DATABASE_URL, 'DB_URL')

const childEnv = {
  ...process.env,
  RUN_SUPABASE_INTEGRATION: '1',
  NODE_ENV: 'test',
  DB_COMPATIBILITY_TARGET: 'simulation',
  SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  DATABASE_URL: dbUrl,
  MIGRATIONS_DATABASE_URL: dbUrl,
  PHASE4A_ADMIN_DATABASE_URL: dbUrl,
  SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: local.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://127.0.0.1:3000',
}
delete childEnv.SOURCE_DATABASE_URL
delete childEnv.TARGET_DATABASE_URL
delete childEnv.RESTORE_TARGET_DB_URL

const child = spawn('npx', ['vitest', 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: childEnv,
  cwd: apiRoot,
})
child.on('exit', (code) => process.exit(code ?? 1))
