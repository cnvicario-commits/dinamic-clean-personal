import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { buildApp } from '../src/app.js'
import { testEnv } from './helpers.js'

const TEST_REF = 'edruejzwwnixsjsadbgb'
const PROD_REF = 'biectbcujabpjhinouil'
const SHA = 'abc1234'

function cristian(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    APP_DEPLOYMENT_ENV: 'cristian-pruebas',
    EXPECTED_SUPABASE_PROJECT_REF: TEST_REF,
    APP_RELEASE_SHA: SHA,
    HOST: '0.0.0.0',
    PORT: '3001',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'https://demo.example.com',
    TRUST_PROXY_CIDRS: '127.0.0.1',
    DATABASE_URL: `postgresql://dinamic_api.${TEST_REF}:secret-value@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
    SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
    MIGRATIONS_DATABASE_URL: '',
    ...overrides,
  }
}

describe('cristian-pruebas deployment guard', () => {
  it('accepts Supabase Test on the pooler and on the direct host', () => {
    expect(loadEnv(cristian()).APP_DEPLOYMENT_ENV).toBe('cristian-pruebas')
    expect(
      loadEnv(
        cristian({
          DATABASE_URL: `postgresql://dinamic_api:secret-value@db.${TEST_REF}.supabase.co:5432/postgres`,
        }),
      ).EXPECTED_SUPABASE_PROJECT_REF,
    ).toBe(TEST_REF)
  })

  it('rejects production, the production pooler, and an ambiguous host', () => {
    expect(() =>
      loadEnv(cristian({ SUPABASE_URL: `https://${PROD_REF}.supabase.co` })),
    ).toThrow(/production/)
    expect(() =>
      loadEnv(
        cristian({
          DATABASE_URL: `postgresql://dinamic_api.${PROD_REF}:secret-value@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
        }),
      ),
    ).toThrow(/production/)
    expect(() =>
      loadEnv(
        cristian({
          DATABASE_URL: 'postgresql://dinamic_api:secret-value@db.internal:5432/postgres',
        }),
      ),
    ).toThrow(/not Supabase Test/)
  })

  it('rejects a migration role and a non-empty migrations URL', () => {
    expect(() =>
      loadEnv(
        cristian({
          DATABASE_URL: `postgresql://postgres.${TEST_REF}:secret-value@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
        }),
      ),
    ).toThrow(/dinamic_api/)
    expect(() =>
      loadEnv(
        cristian({
          MIGRATIONS_DATABASE_URL: `postgresql://postgres.${TEST_REF}:secret-value@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
        }),
      ),
    ).toThrow(/MIGRATIONS_DATABASE_URL/)
  })

  it('does not let NODE_ENV=test or an extra flag skip the checks', () => {
    expect(() => loadEnv(cristian({ NODE_ENV: 'test' }))).toThrow(/NODE_ENV must be production/)
    expect(() =>
      loadEnv(
        cristian({
          SKIP_DEPLOYMENT_GUARD: '1',
          SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
        }),
      ),
    ).toThrow(/production/)
  })

  it('leaves production behavior unchanged when the demo identity is unset', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.example.com',
      DATABASE_URL: `postgresql://dinamic_api.${PROD_REF}:secret-value@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
      SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
    })
    expect(env.APP_DEPLOYMENT_ENV).toBeUndefined()
    expect(env.NODE_ENV).toBe('production')
  })

  it('does not echo the database password in a rejection', () => {
    expect(() => loadEnv(cristian({ SUPABASE_URL: `https://${PROD_REF}.supabase.co` }))).toThrow(
      /production/,
    )
    try {
      loadEnv(cristian({ SUPABASE_URL: `https://${PROD_REF}.supabase.co` }))
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-value')
    }
  })
})

describe('healthz release', () => {
  it('returns the configured sha and nothing else', async () => {
    const app = await buildApp(testEnv({ APP_RELEASE_SHA: SHA }))
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ status: 'ok', release: SHA })
    } finally {
      await app.close()
    }
  })
})
