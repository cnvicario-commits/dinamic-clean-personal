import { afterEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/infrastructure/db/pool.js'
import {
  classifyConnectionTarget,
  refuseNonLocalDatabaseInTest,
} from '../src/infrastructure/db/connection-target.js'
import { testEnv } from './helpers.js'
import {
  assertDinamicCleanTestTarget,
  installTestProcessGuard,
} from './supabase-test-guard.js'

const TEST_REF = 'edruejzwwnixsjsadbgb'
const PROD_REF = 'biectbcujabpjhinouil'
const snapshot = { ...process.env }

afterEach(() => {
  process.env = { ...snapshot }
})

function localSimulation() {
  process.env.RUN_SUPABASE_INTEGRATION = '1'
  process.env.NODE_ENV = 'test'
  process.env.DB_COMPATIBILITY_TARGET = 'simulation'
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.DATABASE_URL = 'postgresql://dinamic_api:secret@127.0.0.1:54322/postgres'
  delete process.env.MIGRATIONS_DATABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.PHASE4A_ADMIN_DATABASE_URL
  delete process.env.SOURCE_DATABASE_URL
  delete process.env.TARGET_DATABASE_URL
  delete process.env.RESTORE_TARGET_DB_URL
}

describe('connection target classification', () => {
  it('rejects the production project ref', () => {
    expect(classifyConnectionTarget(`https://${PROD_REF}.supabase.co`)).toBe('cloud')
  })

  it('rejects the shared test project ref even on loopback', () => {
    expect(
      classifyConnectionTarget(
        `postgresql://dinamic_api.${TEST_REF}:secret@127.0.0.1:5432/postgres`,
      ),
    ).toBe('cloud')
  })

  it('rejects a hosted pooler without a known ref', () => {
    expect(
      classifyConnectionTarget(
        'postgresql://dinamic_api.aaaaaaaaaaaaaaaaaaaa:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
      ),
    ).toBe('cloud')
  })

  it('rejects an unproven host', () => {
    expect(classifyConnectionTarget('postgresql://u:p@db.internal:5432/postgres')).toBe('ambiguous')
  })

  it('accepts loopback postgres and the local API', () => {
    expect(classifyConnectionTarget('postgresql://u:p@127.0.0.1:54322/postgres')).toBe('local')
    expect(classifyConnectionTarget('http://localhost:54321')).toBe('local')
    expect(classifyConnectionTarget('postgresql://u:p@[::1]:5432/postgres')).toBe('local')
  })
})

describe('integration writes stay on a disposable local target', () => {
  it('accepts an explicit local simulation', () => {
    localSimulation()
    expect(() => assertDinamicCleanTestTarget()).not.toThrow()
  })

  it('rejects a hosted test URL', () => {
    localSimulation()
    process.env.SUPABASE_URL = `https://${TEST_REF}.supabase.co`
    expect(() => assertDinamicCleanTestTarget()).toThrow(/Refusing cloud SUPABASE_URL/)
  })

  it('rejects a hosted production URL', () => {
    localSimulation()
    process.env.DATABASE_URL = `postgresql://postgres:secret@db.${PROD_REF}.supabase.co:5432/postgres`
    expect(() => assertDinamicCleanTestTarget()).toThrow(/Refusing cloud DATABASE_URL/)
  })

  it('rejects a pooler URL', () => {
    localSimulation()
    process.env.DATABASE_URL =
      'postgresql://dinamic_api.aaaaaaaaaaaaaaaaaaaa:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
    expect(() => assertDinamicCleanTestTarget()).toThrow(/Refusing cloud DATABASE_URL/)
  })

  it('rejects an ambiguous database host', () => {
    localSimulation()
    process.env.DATABASE_URL = 'postgresql://u:p@db.internal:5432/postgres'
    expect(() => assertDinamicCleanTestTarget()).toThrow(/Refusing ambiguous DATABASE_URL/)
  })

  it('rejects integration when the simulation flag is missing', () => {
    localSimulation()
    delete process.env.DB_COMPATIBILITY_TARGET
    expect(() => assertDinamicCleanTestTarget()).toThrow(/DB_COMPATIBILITY_TARGET=simulation/)
  })

  it('rejects DB_COMPATIBILITY_TARGET=production', () => {
    localSimulation()
    process.env.DB_COMPATIBILITY_TARGET = 'production'
    expect(() => assertDinamicCleanTestTarget()).toThrow(/DB_COMPATIBILITY_TARGET=simulation/)
  })
})

describe('npm test neutralizes inherited cloud configuration', () => {
  it('removes hosted and unproven URLs before any suite can read them', () => {
    delete process.env.RUN_SUPABASE_INTEGRATION
    process.env.DATABASE_URL = `postgresql://postgres:secret@db.${PROD_REF}.supabase.co:5432/postgres`
    process.env.SUPABASE_URL = `https://${TEST_REF}.supabase.co`
    process.env.MIGRATIONS_DATABASE_URL =
      'postgresql://postgres:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
    process.env.PHASE4A_ADMIN_DATABASE_URL = 'postgresql://u:p@db.internal:5432/postgres'
    installTestProcessGuard()
    expect(process.env.DATABASE_URL).toBeUndefined()
    expect(process.env.SUPABASE_URL).toBeUndefined()
    expect(process.env.MIGRATIONS_DATABASE_URL).toBeUndefined()
    expect(process.env.PHASE4A_ADMIN_DATABASE_URL).toBeUndefined()
  })

  it('fails closed when integration is requested against a cloud URL', () => {
    localSimulation()
    process.env.SUPABASE_URL = `https://${TEST_REF}.supabase.co`
    expect(() => installTestProcessGuard()).toThrow(/Refusing cloud SUPABASE_URL/)
  })

  it('fails closed when integration is requested without a local database', () => {
    delete process.env.RUN_SUPABASE_INTEGRATION
    installTestProcessGuard()
    process.env.RUN_SUPABASE_INTEGRATION = '1'
    process.env.NODE_ENV = 'test'
    process.env.DB_COMPATIBILITY_TARGET = 'simulation'
    delete process.env.DATABASE_URL
    delete process.env.SUPABASE_URL
    expect(() => installTestProcessGuard()).toThrow(/local Supabase URL and database/)
  })
})

describe('createDb refuses hosted targets only in the test process', () => {
  it('throws before opening a pool when NODE_ENV is test', () => {
    expect(() =>
      createDb(
        testEnv({
          DATABASE_URL: `postgresql://postgres:secret@db.${PROD_REF}.supabase.co:5432/postgres`,
        }),
      ),
    ).toThrow(/Refusing cloud database target/)
  })

  it('does not apply the test refusal to the dev server', () => {
    expect(() =>
      refuseNonLocalDatabaseInTest(
        `postgresql://dinamic_api.${TEST_REF}:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
        'development',
      ),
    ).not.toThrow()
  })
})
