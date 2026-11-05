/**
 * Independent release records per environment and service.
 * A failed attempt does not replace the last successful record.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DIGEST = /^sha256:[a-f0-9]{64}$/
const SHA = /^[0-9a-f]{40}$/

export function releasePaths(stateDir, environment, service) {
  const dir = join(stateDir, environment)
  return {
    dir,
    record: join(dir, `${service}.json`),
    events: join(dir, `${service}.events.jsonl`),
    lock: join(dir, `${service}.lock`),
  }
}

function checksum(record) {
  const rest = { ...record }
  delete rest.checksum
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex')
}

function stamp(record) {
  return { ...record, checksum: checksum(record) }
}

export function emptyReleaseRecord(environment, service) {
  return {
    version: 1,
    environment,
    service,
    current: null,
    previous: null,
    lastFailed: null,
  }
}

export function validateReleaseIdentity(release) {
  if (!release || typeof release !== 'object') return 'identity'
  if (!SHA.test(release.gitSha ?? '')) return 'sha'
  if (!DIGEST.test(release.digest ?? '')) return 'digest'
  if (!/^[1-9][0-9]*$/.test(String(release.runId ?? ''))) return 'run_id'
  if (!release.image || release.image.includes('latest')) return 'image'
  return ''
}

export function loadReleaseRecord(file, environment, service) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, record: emptyReleaseRecord(environment, service), missing: true }
    return { ok: false, reason: 'unreadable' }
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  if (!parsed || parsed.environment !== environment || parsed.service !== service || parsed.checksum !== checksum(parsed)) {
    return { ok: false, reason: 'corrupt' }
  }
  return { ok: true, record: parsed, missing: false }
}

function writeRecord(file, record) {
  const next = stamp(record)
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(next)}\n`)
  renameSync(temporary, file)
  return next
}

export function acquireReleaseLock(lockPath) {
  try {
    mkdirSync(lockPath)
    return true
  } catch (error) {
    if (error?.code === 'EEXIST') return false
    throw error
  }
}

export function releaseReleaseLock(lockPath) {
  rmSync(lockPath, { recursive: true, force: true })
}

function appendEvent(file, event) {
  appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
}

export function withReleaseLock(stateDir, environment, service, fn) {
  const paths = releasePaths(stateDir, environment, service)
  mkdirSync(paths.dir, { recursive: true })
  // The deploy and rollback shells hold one flock for the whole operation.
  // Skipping the directory lock here avoids releasing it between plan and commit.
  if (process.env.DINAMIC_LOCK_HELD === '1') return fn(paths)
  if (!acquireReleaseLock(paths.lock)) return { ok: false, reason: 'locked' }
  try {
    return fn(paths)
  } finally {
    releaseReleaseLock(paths.lock)
  }
}

export function planDeploy(record, request) {
  const identity = validateReleaseIdentity(request)
  if (identity) return { action: 'reject', reason: identity }
  const current = record.current
  if (!current) return { action: 'proceed' }
  if (current.gitSha === request.gitSha && current.digest === request.digest && String(current.runId) === String(request.runId)) {
    return { action: 'idempotent' }
  }
  if (Number(request.runId) < Number(current.runId)) return { action: 'reject', reason: 'stale_run' }
  if (String(request.runId) === String(current.runId) && Number(request.runAttempt ?? 1) <= Number(current.runAttempt ?? 1)) {
    return { action: 'reject', reason: 'stale_attempt' }
  }
  return { action: 'proceed' }
}

export function planRecover(record) {
  if (!record.current) return { action: 'unavailable', reason: 'no_successful_release' }
  const identity = validateReleaseIdentity(record.current)
  if (identity) return { action: 'reject', reason: identity }
  return { action: 'restore', release: record.current }
}

export function planOperatorRollback(record) {
  if (!record.previous) return { action: 'unavailable', reason: 'no_previous_release' }
  const identity = validateReleaseIdentity(record.previous)
  if (identity) return { action: 'reject', reason: identity }
  return { action: 'restore', release: record.previous }
}

function releaseChanged(current, request) {
  if (!current) return false
  return current.gitSha !== request.gitSha || current.digest !== request.digest
}

export function commitSuccess(record, request) {
  return {
    ...record,
    previous: releaseChanged(record.current, request) ? record.current : record.previous,
    current: { ...request, result: 'success' },
  }
}

export function rememberFailure(record, request, phase, reason) {
  return {
    ...record,
    lastFailed: { ...request, phase, reason, result: 'failed' },
  }
}

export function commitOperatorRollback(record) {
  if (!record.previous) return record
  return {
    ...record,
    current: { ...record.previous, result: 'success' },
    previous: record.current ? { ...record.current, result: 'success' } : record.previous,
  }
}

export function openRelease(stateDir, environment, service) {
  const paths = releasePaths(stateDir, environment, service)
  mkdirSync(paths.dir, { recursive: true })
  const loaded = loadReleaseRecord(paths.record, environment, service)
  return { paths, loaded }
}

export function saveRelease(paths, record, event) {
  const saved = writeRecord(paths.record, record)
  if (event) appendEvent(paths.events, event)
  return saved
}

export function digestMatches(expected, actual) {
  if (!DIGEST.test(expected ?? '')) return false
  const values = Array.isArray(actual) ? actual : [actual]
  return values.some((value) => value === expected || value?.endsWith(`@${expected}`))
}

function requestFromEnv() {
  return {
    gitSha: process.env.RELEASE_SHA,
    digest: process.env.RELEASE_DIGEST,
    runId: process.env.RELEASE_RUN_ID,
    runAttempt: Number(process.env.RELEASE_RUN_ATTEMPT || '1'),
    image: process.env.RELEASE_IMAGE,
    deployedAt: new Date().toISOString(),
  }
}

function printDecision(decision) {
  if (decision.action === 'restore') {
    console.log(`RELEASE_RESTORE ${decision.release.gitSha} ${decision.release.digest} ${decision.release.image}`)
    return
  }
  if (decision.action === 'proceed' || decision.action === 'idempotent') {
    console.log(`RELEASE_${decision.action.toUpperCase()}`)
    return
  }
  console.error(`RELEASE_REJECTED ${decision.reason || decision.action}`)
  process.exitCode = 1
}

const invoked = process.argv[1]?.endsWith('release-state.mjs')
if (invoked) {
  const [command, stateDir, environment, service] = process.argv.slice(2)
  if (!command || !stateDir || !environment || !service) {
    console.error('RELEASE_REJECTED usage')
    process.exit(2)
  }
  const locked = withReleaseLock(stateDir, environment, service, (paths) => {
    const opened = loadReleaseRecord(paths.record, environment, service)
    if (!opened.ok) {
      console.error(`RELEASE_REJECTED ${opened.reason}`)
      process.exitCode = 1
      return
    }
    const request = requestFromEnv()
    if (command === 'plan') {
      printDecision(planDeploy(opened.record, request))
      return
    }
    if (command === 'commit') {
      const planned = planDeploy(opened.record, request)
      if (planned.action === 'reject') {
        printDecision(planned)
        return
      }
      if (planned.action === 'proceed') saveRelease(paths, commitSuccess(opened.record, request), { action: 'commit', service, gitSha: request.gitSha, digest: request.digest, runId: request.runId })
      console.log('RELEASE_COMMITTED')
      return
    }
    if (command === 'fail') {
      const phase = process.env.RELEASE_PHASE || 'before_recreate'
      const reason = process.env.RELEASE_REASON || 'failed'
      saveRelease(paths, rememberFailure(opened.record, request, phase, reason), { action: 'fail', phase, reason, service, gitSha: request.gitSha, runId: request.runId })
      console.log(`RELEASE_FAILURE_RECORDED ${phase}`)
      return
    }
    if (command === 'recover') {
      printDecision(planRecover(opened.record))
      return
    }
    if (command === 'hold') {
      writeSync(1, 'RELEASE_HOLDING\n')
      execFileSync('sleep', [process.env.HOLD_SECONDS || '0.4'])
      console.log('RELEASE_HELD')
      return
    }
    if (command === 'show') {
      console.log(opened.record.current ? `RELEASE_CURRENT ${opened.record.current.gitSha}` : 'RELEASE_CURRENT none')
      return
    }
    if (command === 'rollback-plan') {
      printDecision(planOperatorRollback(opened.record))
      return
    }
    if (command === 'rollback-commit') {
      const planned = planOperatorRollback(opened.record)
      if (planned.action !== 'restore') {
        printDecision(planned)
        return
      }
      saveRelease(paths, commitOperatorRollback(opened.record), { action: 'rollback', service, gitSha: planned.release.gitSha, digest: planned.release.digest })
      printDecision(planned)
      return
    }
    if (command === 'digest') {
      const actual = JSON.parse(process.env.RELEASE_ACTUAL || '[]')
      if (!digestMatches(process.env.RELEASE_DIGEST, actual)) {
        console.error('RELEASE_REJECTED digest')
        process.exitCode = 1
        return
      }
      console.log('RELEASE_DIGEST_OK')
      return
    }
    if (command === 'rollback') {
      const planned = planOperatorRollback(opened.record)
      if (planned.action !== 'restore') {
        printDecision(planned)
        return
      }
      saveRelease(paths, commitOperatorRollback(opened.record), { action: 'rollback', service, gitSha: planned.release.gitSha, digest: planned.release.digest })
      printDecision(planned)
    }
  })
  if (locked && locked.ok === false) {
    console.error(`RELEASE_REJECTED ${locked.reason}`)
    process.exit(1)
  }
}
