import { afterEach, describe, expect, it } from 'vitest'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const TEST_REF = 'aaaaaaaaaaaaaaaaaaaa'
const PROD_REF = 'bbbbbbbbbbbbbbbbbbbb'

const snapshot = { ...process.env }

afterEach(() => {
  process.env = { ...snapshot }
})

function allowTestEnv() {
  process.env.RUN_SUPABASE_INTEGRATION = '1'
  process.env.NODE_ENV = 'test'
  process.env.DB_COMPATIBILITY_TARGET = 'test'
  process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF = TEST_REF
  process.env.EXPECTED_SUPABASE_PROJECT_REF = TEST_REF
  process.env.SUPABASE_URL = `https://${TEST_REF}.supabase.co`
  process.env.DATABASE_URL = `postgresql://dinamic_api.${TEST_REF}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
  delete process.env.EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF
}

describe('integration writes reject a production target', () => {
  it('allows the identified test project', () => {
    allowTestEnv()
    expect(() => assertDinamicCleanTestTarget()).not.toThrow()
  })

  it('rejects DB_COMPATIBILITY_TARGET=production even when the URL is the test project', () => {
    allowTestEnv()
    process.env.DB_COMPATIBILITY_TARGET = 'production'
    expect(() => assertDinamicCleanTestTarget()).toThrow(/DB_COMPATIBILITY_TARGET is not test/)
  })

  it('rejects DATABASE_URL=prod while DB_COMPATIBILITY_TARGET=test', () => {
    allowTestEnv()
    process.env.DATABASE_URL = `postgresql://dinamic_api.${PROD_REF}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
    expect(() => assertDinamicCleanTestTarget()).toThrow(/DATABASE_URL project ref does not match/)
  })

  it('rejects a test label that points at the configured production ref', () => {
    allowTestEnv()
    process.env.EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF = PROD_REF
    process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF = PROD_REF
    process.env.EXPECTED_SUPABASE_PROJECT_REF = PROD_REF
    process.env.SUPABASE_URL = `https://${PROD_REF}.supabase.co`
    process.env.DATABASE_URL = `postgresql://dinamic_api.${PROD_REF}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
    expect(() => assertDinamicCleanTestTarget()).toThrow(/must not equal EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF/)
  })

  it('allows a localhost simulation and rejects a hosted URL marked as simulation', () => {
    process.env.RUN_SUPABASE_INTEGRATION = '1'
    process.env.NODE_ENV = 'test'
    process.env.DB_COMPATIBILITY_TARGET = 'simulation'
    process.env.EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF = PROD_REF
    process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF = TEST_REF
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.DATABASE_URL = 'postgresql://dinamic_api:secret@127.0.0.1:54322/postgres'
    expect(() => assertDinamicCleanTestTarget()).not.toThrow()
    process.env.SUPABASE_URL = `https://${PROD_REF}.supabase.co`
    expect(() => assertDinamicCleanTestTarget()).toThrow(/local Supabase URL|production/)
  })
})
