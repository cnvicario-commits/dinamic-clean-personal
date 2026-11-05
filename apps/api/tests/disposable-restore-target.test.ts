import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { classifyConnectionTarget } from '../src/infrastructure/db/connection-target.js'
import { classifyDisposableTarget } from '../../../scripts/disposable-target.mjs'

const script = fileURLToPath(new URL('../../../scripts/disposable-target.mjs', import.meta.url))

const CASES = [
  ['production host', `postgresql://postgres:secret@db.biectbcujabpjhinouil.supabase.co:5432/postgres`],
  ['hosted test project', 'https://edruejzwwnixsjsadbgb.supabase.co'],
  ['test ref on loopback', 'postgresql://dinamic_api.edruejzwwnixsjsadbgb:secret@127.0.0.1:5432/postgres'],
  ['production ref on loopback', 'postgresql://postgres.biectbcujabpjhinouil:secret@127.0.0.1:5432/postgres'],
  ['cloud pooler', 'postgresql://dinamic_api.aaaaaaaaaaaaaaaaaaaa:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres'],
  ['ambiguous host', 'postgresql://u:p@db.internal:5432/postgres'],
  ['unparseable', 'not-a-url'],
  ['empty', ''],
] as const

function run(url: string, extra: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, url], {
    encoding: 'utf8',
    env: { ...process.env, ...extra },
  })
}

describe('destructive restore target', () => {
  it.each(CASES)('rejects %s even when confirmation is set', (_label, url) => {
    const result = run(url, { I_CONFIRM_DISPOSABLE: 'yes' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/RESTORE_TARGET_REJECTED/)
    expect(result.stderr).not.toContain('secret')
    expect(result.stdout).not.toContain('secret')
    expect(classifyDisposableTarget(url)).not.toBe('local')
    expect(classifyConnectionTarget(url)).not.toBe('local')
  })

  it('accepts a loopback database and does not connect', () => {
    const url = 'postgresql://supabase_admin:secret@127.0.0.1:54322/postgres'
    const result = run(url)
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(classifyDisposableTarget(url)).toBe('local')
    expect(classifyConnectionTarget(url)).toBe('local')
  })

  it('accepts localhost and ipv6 loopback', () => {
    expect(classifyDisposableTarget('postgresql://u:p@localhost:5432/postgres')).toBe('local')
    expect(classifyDisposableTarget('postgresql://u:p@[::1]:5432/postgres')).toBe('local')
  })
})
