import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assessMigrationUrl } from '../../../scripts/assert-migration-target.mjs'

const script = fileURLToPath(new URL('../../../scripts/assert-migration-target.mjs', import.meta.url))
const PROD = 'postgresql://postgres:secret@db.biectbcujabpjhinouil.supabase.co:5432/postgres'
const TEST_DIRECT = 'postgresql://postgres:secret@db.edruejzwwnixsjsadbgb.supabase.co:5432/postgres'
const TEST_POOLER = 'postgresql://dinamic_api.edruejzwwnixsjsadbgb:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
const LOCAL = 'postgresql://postgres:secret@127.0.0.1:55432/postgres'

function run(url: string, env: Record<string, string> = {}) {
  const childEnv = { ...process.env, ...env }
  if (!Object.prototype.hasOwnProperty.call(env, 'DINAMIC_MIGRATION_TARGET')) {
    delete childEnv.DINAMIC_MIGRATION_TARGET
  }
  return spawnSync(process.execPath, [script, url], {
    encoding: 'utf8',
    env: childEnv,
  })
}

describe('forward migration target guard', () => {
  it('rejects production even when a disposable flag is set', () => {
    const result = run(PROD, { DINAMIC_MIGRATION_TARGET: 'disposable-local' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('MIGRATION_TARGET_REJECTED production')
    expect(result.stderr).not.toContain('secret')
    expect(assessMigrationUrl(PROD, true).ok).toBe(false)
  })

  it('rejects a pooler and an ambiguous host that are not the test project', () => {
    const pooler = 'postgresql://dinamic_api.aaaaaaaaaaaaaaaaaaaa:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
    const ambiguous = 'postgresql://u:p@db.internal:5432/postgres'
    for (const url of [pooler, ambiguous, '']) {
      const result = run(url)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(/MIGRATION_TARGET_REJECTED/)
      expect(result.stderr).not.toContain('secret')
    }
  })

  it('accepts the test project on its direct host and its pooler', () => {
    for (const url of [TEST_DIRECT, TEST_POOLER]) {
      const result = run(url)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('MIGRATION_TARGET test-cloud')
      expect(result.stdout).not.toContain('secret')
    }
  })

  it('rejects the test ref on an unexpected host', () => {
    const url = 'postgresql://dinamic_api.edruejzwwnixsjsadbgb:secret@127.0.0.1:5432/postgres'
    expect(run(url).stderr).toContain('MIGRATION_TARGET_REJECTED test-ref-unexpected-host')
  })

  it('accepts loopback only when the disposable marker is set', () => {
    expect(run(LOCAL).stderr).toContain('MIGRATION_TARGET_REJECTED local-not-marked-disposable')
    const allowed = run(LOCAL, { DINAMIC_MIGRATION_TARGET: 'disposable-local' })
    expect(allowed.status).toBe(0)
    expect(allowed.stdout).toContain('MIGRATION_TARGET disposable-local')
    expect(allowed.stdout).not.toContain('secret')
  })
})
