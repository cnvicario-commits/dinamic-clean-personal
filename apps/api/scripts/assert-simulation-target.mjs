#!/usr/bin/env node
/** Exit 2 unless SOURCE is production and TARGET is a different simulation database. */
import { assertCloneTargets, databaseHost, projectRefFromDatabaseUrl } from './db-release-lib.mjs'

const decision = assertCloneTargets({
  sourceRef: projectRefFromDatabaseUrl(process.env.SOURCE_DATABASE_URL ?? ''),
  targetRef: projectRefFromDatabaseUrl(process.env.TARGET_DATABASE_URL ?? ''),
  targetHost: databaseHost(process.env.TARGET_DATABASE_URL ?? ''),
  productionRef: process.env.EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF,
  testRef: process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF,
  simulationRef: process.env.EXPECTED_SUPABASE_SIMULATION_PROJECT_REF,
  targetLabel: process.env.DB_COMPATIBILITY_TARGET,
  simulationConfirmed: process.env.SIMULATION_CONFIRM === 'yes',
})
if (decision) {
  console.error(`BLOCKED_BY_ENVIRONMENT_GUARD ${decision}`)
  process.exit(2)
}
console.log('SIMULATION_TARGET_OK')
