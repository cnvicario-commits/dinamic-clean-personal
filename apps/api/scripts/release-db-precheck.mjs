#!/usr/bin/env node
/** Read-only release precheck. Does not apply migrations. */
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareMigrations,
  evaluateEnvironmentGuard,
  projectRefFromDatabaseUrl,
  readForwardHistory,
  redact,
  repoMigrations,
} from './db-release-lib.mjs'

const apiRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repoRoot = resolve(apiRoot, '../..')
const envFile = process.env.ENV_FILE
if (!envFile) {
  console.log('BLOCKED_BY_ENVIRONMENT_GUARD')
  console.error('ENV_FILE is required')
  process.exit(2)
}
loadDotenv({ path: resolve(envFile), override: true, quiet: true })

const databaseUrl = process.env.DATABASE_URL ?? ''
const dbRef = projectRefFromDatabaseUrl(databaseUrl)
const guard = evaluateEnvironmentGuard({
  target: process.env.DB_COMPATIBILITY_TARGET,
  dbRef,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  testRef: process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF,
  productionRef: process.env.EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF,
  purpose: 'read',
})
if (!databaseUrl || !dbRef) {
  console.log('BLOCKED_BY_ENVIRONMENT_GUARD')
  console.error('DATABASE_URL is missing or its project ref could not be parsed')
  process.exit(2)
}
if (guard) {
  console.log(guard)
  process.exit(2)
}

try {
  const repo = repoMigrations(repoRoot)
  let applied
  try {
    applied = await readForwardHistory(databaseUrl, process.env.MIGRATIONS_DATABASE_URL)
  } catch (error) {
    console.error(redact(error instanceof Error ? error.message : 'history_unavailable'))
    console.log('BLOCKED_BY_SCHEMA_DRIFT')
    process.exit(3)
  }
  const { drift, pending } = compareMigrations(repo, applied)
  console.log(`target=${process.env.DB_COMPATIBILITY_TARGET ?? 'unset'}`)
  console.log(`project_ref=${dbRef}`)
  console.log(`applied=${applied.length}`)
  console.log(`pending=${pending.length}`)
  for (const name of pending) console.log(`pending_file=${name}`)
  if (drift.length) {
    for (const row of drift) console.log(`drift=${row.kind} ${row.filename}`)
    console.log('BLOCKED_BY_SCHEMA_DRIFT')
    process.exit(3)
  }
  console.log('READY_FOR_MIGRATION_SIMULATION')
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : 'precheck_failed'))
  console.log('BLOCKED_BY_SCHEMA_DRIFT')
  process.exit(3)
}
