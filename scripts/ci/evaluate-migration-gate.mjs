/**
 * Admission check for the manual Test migration workflow.
 * It does not connect and it does not accept a caller-selected branch.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SHA = /^[0-9a-f]{40}$/

export function stripSqlComments(sql) {
  return String(sql).replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
}

export function isDestructiveSql(sql) {
  return /^\s*(drop\s+(table|schema|column)|truncate\s+|delete\s+from)\b/im.test(stripSqlComments(sql))
}

export function findDestructiveMigrations(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql') && !name.endsWith('.rollback.sql'))
    .filter((name) => isDestructiveSql(readFileSync(join(dir, name), 'utf8')))
    .sort()
}

export function evaluateMigrationGate(input) {
  if (input.ref !== 'refs/heads/main') return { ok: false, reason: 'branch' }
  if (input.confirm !== 'migrate-test') return { ok: false, reason: 'confirm' }
  if (input.enabled !== 'true') return { ok: false, reason: 'disabled' }
  if (!SHA.test(input.githubSha ?? '') || input.headSha !== input.githubSha) return { ok: false, reason: 'sha' }
  if (input.targetKind != null && input.targetKind !== '' && input.targetKind !== 'test-cloud') return { ok: false, reason: 'target' }
  if (input.destructive) return { ok: false, reason: 'destructive' }
  return { ok: true, reason: '' }
}

const invoked = process.argv[1]?.endsWith('evaluate-migration-gate.mjs')
if (invoked) {
  const decision = evaluateMigrationGate({
    ref: process.env.REF,
    confirm: process.env.CONFIRM,
    enabled: process.env.ENABLED,
    githubSha: process.env.GITHUB_SHA,
    headSha: process.env.HEAD_SHA,
    targetKind: process.env.TARGET_KIND,
    destructive: process.env.DESTRUCTIVE === 'true',
  })
  if (!decision.ok) {
    console.error(`MIGRATIONS_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  console.log('MIGRATIONS_ADMITTED')
}
