import { describe, expect, it } from 'vitest'
import { compareMigrations, evaluateEnvironmentGuard, historyComparison, assertCloneTargets } from '../scripts/db-release-lib.mjs'

const TEST_REF = 'aaaaaaaaaaaaaaaaaaaa'
const PROD_REF = 'bbbbbbbbbbbbbbbbbbbb'

describe('release environment guard', () => {
  it('blocks a test label whose database is the production ref', () => {
    expect(
      evaluateEnvironmentGuard({
        target: 'test',
        dbRef: PROD_REF,
        expectedProjectRef: TEST_REF,
        testRef: TEST_REF,
        productionRef: PROD_REF,
        purpose: 'read',
      }),
    ).toBe('BLOCKED_BY_ENVIRONMENT_GUARD')
  })

  it('blocks destructive intent when the compatibility target is production', () => {
    expect(
      evaluateEnvironmentGuard({
        target: 'production',
        dbRef: PROD_REF,
        expectedProjectRef: PROD_REF,
        testRef: TEST_REF,
        productionRef: PROD_REF,
        purpose: 'destructive',
      }),
    ).toBe('BLOCKED_BY_ENVIRONMENT_GUARD')
  })

  it('allows a consistent test target', () => {
    expect(
      evaluateEnvironmentGuard({
        target: 'test',
        dbRef: TEST_REF,
        expectedProjectRef: TEST_REF,
        testRef: TEST_REF,
        productionRef: PROD_REF,
        purpose: 'read',
      }),
    ).toBeNull()
  })
})

describe('forward migration comparison', () => {
  it('does not treat a missing history table as an empty applied set', () => {
    expect(historyComparison('relation "app_migrations.forward_history" does not exist', {
      drift: [],
      pending: ['0001_a.sql'],
    })).toEqual({
      pending: null,
      drift: [{ filename: 'app_migrations.forward_history', kind: 'HISTORY_UNAVAILABLE' }],
    })
  })

  it('reports pending files and checksum drift', () => {
    const repo = [
      { filename: '0001_a.sql', checksum: 'aaa' },
      { filename: '0002_b.sql', checksum: 'bbb' },
    ]
    const applied = [
      { filename: '0001_a.sql', checksum: 'zzz' },
      { filename: 'legacy.sql', checksum: 'ccc' },
    ]
    expect(compareMigrations(repo, applied)).toEqual({
      drift: [
        { filename: '0001_a.sql', kind: 'CHECKSUM' },
        { filename: 'legacy.sql', kind: 'DB_ONLY' },
      ],
      pending: ['0002_b.sql'],
    })
  })
})

describe('simulation clone guard', () => {
  const base = {
    sourceRef: 'prodprodprodprodprod',
    targetRef: '',
    targetHost: '127.0.0.1',
    productionRef: 'prodprodprodprodprod',
    testRef: 'testtesttesttesttest',
    simulationRef: '',
    targetLabel: 'simulation',
    simulationConfirmed: true,
  }

  it('allows a local simulation target', () => {
    expect(assertCloneTargets(base)).toBeNull()
  })

  it('rejects a production target and a test target', () => {
    expect(assertCloneTargets({ ...base, targetRef: base.productionRef, targetHost: 'aws-0-sa-east-1.pooler.supabase.com' })).toBe('target is production')
    expect(assertCloneTargets({ ...base, targetRef: base.testRef, targetHost: 'aws-0-us-west-2.pooler.supabase.com' })).toBe('target is test')
  })

  it('rejects an unconfirmed restore', () => {
    expect(assertCloneTargets({ ...base, simulationConfirmed: false })).toBe('simulation restore is not confirmed')
  })
})
