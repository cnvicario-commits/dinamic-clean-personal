#!/usr/bin/env node
/** Read-only deployment gate. It never applies migrations or writes database state. */
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const apiRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repoRoot = resolve(apiRoot, '../..')
for (const path of [resolve(apiRoot, '.env'), resolve(apiRoot, '.env.local'), resolve(repoRoot, '.env'), resolve(repoRoot, '.env.local')]) {
  loadDotenv({ path })
}

function fail(reason) {
  console.error(`DB_COMPATIBILITY_BLOCKED ${reason}`)
  process.exitCode = 2
}

if (process.env.RUN_DB_COMPATIBILITY_CHECK !== '1') fail('RUN_DB_COMPATIBILITY_CHECK=1 is required')
const target = process.env.DB_COMPATIBILITY_TARGET
if (!['test', 'staging', 'production'].includes(target ?? '')) fail('DB_COMPATIBILITY_TARGET must be test, staging or production')
const expected = (process.env.EXPECTED_SUPABASE_PROJECT_REF ?? '').trim().toLowerCase()
const supabaseUrl = process.env.SUPABASE_URL ?? ''
const databaseUrl = process.env.DATABASE_URL ?? ''
const urlMatch = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)
if (!expected) fail('EXPECTED_SUPABASE_PROJECT_REF is required')
if (!urlMatch || urlMatch[1].toLowerCase() !== expected) fail('SUPABASE_URL project ref mismatch')
if (!databaseUrl) fail('DATABASE_URL is required')
const dbRefMatch = databaseUrl.match(/(?:postgresql:\/\/[^:@]*?\.|\.)([a-z0-9]+)(?:[:@]|\.pooler\.supabase)/i)
const dbRef = (process.env.DATABASE_PROJECT_REF ?? dbRefMatch?.[1] ?? '').toLowerCase()
if (!dbRef) fail('DATABASE_PROJECT_REF is required when DATABASE_URL does not encode project ref')
if (dbRef !== expected) fail('DATABASE_URL project ref mismatch')
if (process.exitCode) process.exit()

const { loadEnv } = await import('../dist/config/env.js')
const { probePhase3aCapabilities } = await import('../dist/infrastructure/db/phase3a-capabilities.js')
const env = loadEnv(process.env)
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  ssl: /supabase\.co|pooler\.supabase/i.test(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
})
try {
  const result = await probePhase3aCapabilities((text, params) => pool.query(text, params))
  if (!result.ok) {
    console.error(JSON.stringify({ event: 'db_schema_incompatible', target, reason: result.reason }))
    process.exitCode = 3
  } else {
    console.log(JSON.stringify({ event: 'db_schema_compatible', target, projectRef: expected, currentUser: result.currentUser }))
  }
} catch (error) {
  console.error(JSON.stringify({ event: 'db_schema_incompatible', target, reason: error instanceof Error ? error.message : 'probe_failed' }))
  process.exitCode = 3
} finally {
  await pool.end()
}
