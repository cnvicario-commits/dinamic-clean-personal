import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assessMigrationUrl } from '../../scripts/assert-migration-target.mjs'
import { evaluateCristianDeployGate } from '../../scripts/ci/evaluate-cristian-deploy-gate.mjs'
import { evaluateMigrationGate, findDestructiveMigrations, isDestructiveSql } from '../../scripts/ci/evaluate-migration-gate.mjs'
import { evaluateProductionDeployGate } from '../../scripts/ci/evaluate-production-deploy-gate.mjs'
import { readSuccessfulCiRun } from '../../scripts/ci/read-successful-ci-run.mjs'
import { assessHealthPayload, probeUrl } from '../../scripts/deploy/assess-health.mjs'
import { assessProductionCompose } from '../../scripts/deploy/assess-production-compose.mjs'
import { classifyDeploymentPath, assertPrivileged } from '../../scripts/deploy/path-boundary.mjs'
import { assessAdoption } from '../../scripts/deploy/assess-adoption.mjs'
import { commitOperatorRollback, commitSuccess, digestMatches, emptyReleaseRecord, loadReleaseRecord, planDeploy, releasePaths, saveRelease } from '../../scripts/deploy/release-state.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const shaA = 'a'.repeat(40)
const shaB = 'b'.repeat(40)
const shaC = 'c'.repeat(40)
const shaD = 'd'.repeat(40)
const digestA = `sha256:${'ab'.repeat(32)}`
const digestB = `sha256:${'bc'.repeat(32)}`
const digestC = `sha256:${'cd'.repeat(32)}`
const digestD = `sha256:${'de'.repeat(32)}`

function release(sha: string, digest: string, runId: string) {
  return { gitSha: sha, digest, runId, runAttempt: 1, image: `ghcr.io/example/service@${digest}`, deployedAt: '2026-11-05T00:00:00.000Z' }
}

function nodeScript(script: string, input = '') {
  return spawnSync('node', [script], { cwd: root, input, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } })
}

describe('health contracts', () => {
  it('accepts readyz ready and rejects the old ok contract', () => {
    expect(assessHealthPayload('api-readyz', JSON.stringify({ status: 'ready' })).ok).toBe(true)
    expect(assessHealthPayload('api-readyz', JSON.stringify({ status: 'ok' })).reason).toBe('status')
  })

  it('rejects an unavailable or mismatched release', async () => {
    expect(assessHealthPayload('api-healthz', JSON.stringify({ status: 'ok', release: shaC }), { sha: shaA }).reason).toBe('release')
    const unavailable = await probeUrl('http://127.0.0.1:9/readyz', {
      attempts: 1,
      timeoutMs: 50,
      fetchImpl: async () => ({ status: 503, text: async () => '{"status":"not_ready"}' }) as Response,
    })
    expect(unavailable.reason).toBe('http_503')
    const timedOut = await probeUrl('http://fixture/readyz', {
      attempts: 2,
      timeoutMs: 5,
      fetchImpl: () => new Promise((_resolve, reject) => {
        const error = new Error('timeout')
        error.name = 'TimeoutError'
        reject(error)
      }),
    })
    expect(timedOut.reason).toBe('timeout')
  })

  it('does not require the API for a healthy frontend', () => {
    const decision = assessHealthPayload('frontend-healthz', JSON.stringify({
      status: 'ok', release: shaA, deployment: 'cristian-pruebas',
    }), { sha: shaA })
    expect(decision.ok).toBe(true)
  })
})

describe('independent release state', () => {
  it('rolls each service back to its own previous success', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-release-'))
    const frontend = releasePaths(dir, 'cristian', 'frontend')
    const api = releasePaths(dir, 'cristian', 'api')
    saveRelease(frontend, commitSuccess(emptyReleaseRecord('cristian', 'frontend'), release(shaA, digestA, '10')), { action: 'seed' })
    saveRelease(api, commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaB, digestB, '11')), { action: 'seed' })
    const failed = loadReleaseRecord(frontend.record, 'cristian', 'frontend')
    expect(planDeploy(failed.record, release(shaC, digestC, '12')).action).toBe('proceed')
    expect(loadReleaseRecord(api.record, 'cristian', 'api').record.current.gitSha).toBe(shaB)
    expect(planDeploy(loadReleaseRecord(api.record, 'cristian', 'api').record, release(shaD, digestD, '9')).reason).toBe('stale_run')
  })

  it('keeps the last success when planning fails before or after recreate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-release-'))
    const paths = releasePaths(dir, 'cristian', 'api')
    saveRelease(paths, commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaB, digestB, '4')), { action: 'seed' })
    const before = readFileSync(paths.record, 'utf8')
    expect(planDeploy(loadReleaseRecord(paths.record, 'cristian', 'api').record, { ...release(shaD, 'sha256:nope', '5') }).reason).toBe('digest')
    expect(readFileSync(paths.record, 'utf8')).toBe(before)
    writeFileSync(paths.record, '{')
    expect(loadReleaseRecord(paths.record, 'cristian', 'api').reason).toBe('corrupt')
    expect(readFileSync(paths.record, 'utf8')).toBe('{')
  })

  it('rejects a digest that is not the pulled image', () => {
    expect(digestMatches(digestA, [`ghcr.io/example/api@${digestA}`])).toBe(true)
    expect(digestMatches(digestA, [digestC])).toBe(false)
  })

  it('rejects a second writer while the lock is held', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-lock-'))
    const first = spawn('node', ['scripts/deploy/release-state.mjs', 'hold', dir, 'cristian', 'api'], {
      cwd: root,
      env: { ...process.env, HOLD_SECONDS: '0.8' },
    })
    await new Promise((resolve) => first.stdout.once('data', resolve))
    const second = spawnSync('node', ['scripts/deploy/release-state.mjs', 'plan', dir, 'cristian', 'api'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, RELEASE_SHA: shaA, RELEASE_DIGEST: digestA, RELEASE_RUN_ID: '1', RELEASE_IMAGE: `ghcr.io/example/api@${digestA}` },
    })
    await new Promise((resolve) => first.once('close', resolve))
    expect(second.status).toBe(1)
    expect(second.stderr).toContain('RELEASE_REJECTED locked')
  })
})

describe('CI must authorize the exact SHA', () => {
  const base = {
    eventName: 'workflow_run',
    repository: 'cnvicario-commits/dinamic-clean-personal',
    headRepository: 'cnvicario-commits/dinamic-clean-personal',
    workflowName: 'ci',
    conclusion: 'success',
    triggeringEvent: 'push',
    headBranch: 'cristian-pruebas',
    headSha: shaA,
  }

  it('deploys only a successful push of that SHA', () => {
    expect(evaluateCristianDeployGate(base).action).toBe('deploy')
    expect(evaluateCristianDeployGate({ ...base, conclusion: 'failure' }).action).toBe('skip')
    expect(evaluateCristianDeployGate({ ...base, conclusion: 'cancelled' }).action).toBe('skip')
    expect(evaluateCristianDeployGate({ ...base, headSha: 'abc' }).reason).toBe('sha')
    expect(evaluateCristianDeployGate({ ...base, headBranch: 'main' }).reason).toBe('branch')
    expect(evaluateCristianDeployGate({ ...base, triggeringEvent: 'pull_request' }).action).toBe('skip')
    expect(evaluateCristianDeployGate({ ...base, headRepository: 'other/fork' }).reason).toBe('fork')
  })

  it('reads the CI run instead of trusting a dispatch input', () => {
    const expected = { sha: shaA, branch: 'cristian-pruebas', repository: 'cnvicario-commits/dinamic-clean-personal' }
    const run = { id: 20, head_sha: shaA, head_branch: 'cristian-pruebas', event: 'push', conclusion: 'success', head_repository: { full_name: expected.repository } }
    expect(readSuccessfulCiRun({ workflow_runs: [run] }, expected).runId).toBe('20')
    expect(readSuccessfulCiRun({ workflow_runs: [{ ...run, head_sha: shaC }] }, expected).reason).toBe('sha')
    expect(readSuccessfulCiRun({ workflow_runs: [{ ...run, head_branch: 'main' }] }, expected).reason).toBe('branch')
    expect(readSuccessfulCiRun({ workflow_runs: [{ ...run, conclusion: 'failure' }] }, expected).reason).toBe('conclusion')
    expect(readSuccessfulCiRun({ workflow_runs: [{ ...run, conclusion: 'cancelled' }] }, expected).reason).toBe('conclusion')
    expect(readSuccessfulCiRun({ workflow_runs: [] }, expected).reason).toBe('missing')
    expect(readSuccessfulCiRun({}, expected).reason).toBe('missing')
    expect(readSuccessfulCiRun({ workflow_runs: [{ ...run, head_repository: { full_name: 'other/fork' } }] }, expected).reason).toBe('fork')
    expect(readSuccessfulCiRun({ workflow_runs: [{ ...run, id: 4, event: 'pull_request' }] }, expected).reason).toBe('event')
    const selected = readSuccessfulCiRun({
      workflow_runs: [
        { ...run, id: 30, conclusion: 'failure' },
        { ...run, id: 18 },
        { ...run, id: 22 },
      ],
    }, expected)
    expect(selected.ok).toBe(true)
    expect(selected.runId).toBe('22')
    expect(selected.conclusion).toBe('success')
    expect(selected.event).toBe('push')
    expect(selected.branch).toBe('cristian-pruebas')
  })
})

describe('migration admission', () => {
  const request = { ref: 'refs/heads/main', confirm: 'migrate-test', enabled: 'true', githubSha: shaA, headSha: shaA, destructive: false, targetKind: 'test-cloud' }

  it('rejects the wrong branch, SHA, target, and destructive SQL', () => {
    expect(evaluateMigrationGate({ ...request, ref: 'refs/heads/cristian-pruebas' }).reason).toBe('branch')
    expect(evaluateMigrationGate({ ...request, headSha: shaC }).reason).toBe('sha')
    expect(evaluateMigrationGate({ ...request, targetKind: 'production' }).reason).toBe('target')
    expect(evaluateMigrationGate({ ...request, destructive: true }).reason).toBe('destructive')
    expect(isDestructiveSql('revoke truncate on table public.empresas from anon;')).toBe(false)
    expect(isDestructiveSql('DROP TABLE public.empresas;')).toBe(true)
    expect(findDestructiveMigrations(join(root, 'supabase/migrations/forward'))).toEqual([])
    expect(assessMigrationUrl('postgresql://postgres.biectbcujabpjhinouil:secret@example.pooler.supabase.com:5432/postgres').reason).toBe('production')
  })
})

describe('production compose gate', () => {
  const compose = [
    'services:',
    '  api:',
    '    container_name: dinamic-clean-api',
    '    ports:',
    '      - "3005:3001"',
  ].join('\n')

  it('accepts the stated production shape and rejects Test and Cristian markers', () => {
    expect(assessProductionCompose(compose, { composePath: '/opt/dinamic-clean-privileged/compose/api.yml', sha: shaA }).ok).toBe(true)
    expect(assessProductionCompose(`${compose}\nedruejzwwnixsjsadbgb`, { composePath: '/opt/dinamic-clean-privileged/compose/api.yml', sha: shaA }).reason).toBe('cristian_config')
    expect(assessProductionCompose(compose, { composePath: '/opt/dinamic-clean/docker-compose.yml', sha: shaA }).reason).toBe('compose_path')
    expect(evaluateProductionDeployGate({ ref: 'refs/heads/feature', confirm: 'deploy-production', enabled: 'true', sha: shaA, ciSha: shaA, ciBranch: 'main', ciEvent: 'push', ciConclusion: 'success' }).reason).toBe('ref')
  })
})

describe('path boundary', () => {
  it('does not treat the Cristian checkout as production', () => {
    expect(classifyDeploymentPath('/opt/dinamic-clean-cristian')).toBe('cristian-checkout')
    expect(classifyDeploymentPath('/opt/dinamic-clean')).toBe('production')
    expect(classifyDeploymentPath('/opt/dinamic-clean/certs')).toBe('production')
    expect(classifyDeploymentPath('/opt/dinamic-clean-privileged/bin')).toBe('privileged')
    expect(assertPrivileged('/opt/dinamic-clean-privileged').ok).toBe(true)
    expect(assertPrivileged('/opt/dinamic-clean-privileged/bin/cristian-apply').ok).toBe(true)
    expect(assertPrivileged('/opt/dinamic-clean').ok).toBe(false)
    expect(assertPrivileged('/opt/dinamic-clean/repo').ok).toBe(false)
    expect(assertPrivileged('/opt/dinamic-clean-cristian').ok).toBe(false)
    expect(assertPrivileged('/tmp/not-privileged').ok).toBe(false)
    expect(assertPrivileged('/opt/dinamic-clean-privileged/bin/../../dinamic-clean').reason).toBe('traversal')
    const cristian = spawnSync('python3', ['scripts/assert-cristian-frontend-compose-render.py', '--path-class', '/opt/dinamic-clean-cristian'], { cwd: root, encoding: 'utf8' })
    const production = spawnSync('python3', ['scripts/assert-cristian-frontend-compose-render.py', '--path-class', '/opt/dinamic-clean/certs'], { cwd: root, encoding: 'utf8' })
    expect(cristian.stdout.trim()).toBe('allowed')
    expect(production.stdout.trim()).toBe('production')
  })
})

describe('Cristian deploy fixture', () => {
  function apply(dir: string, service: string, sha: string, digest: string, runId: string, extra: Record<string, string> = {}) {
    const body = JSON.stringify({ status: 'ok', release: sha, deployment: 'cristian-pruebas' })
    return spawnSync('bash', ['scripts/deploy/cristian-remote-apply.sh', service, sha, digest, runId], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DINAMIC_DEPLOY_FIXTURE: '1',
        DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'),
        DINAMIC_RELEASE_STATE_DIR: dir,
        CRISTIAN_REGISTRY: 'ghcr.io/example',
        FIXTURE_API_HEALTHZ_BODY: body,
        FIXTURE_API_READYZ_BODY: JSON.stringify({ status: 'ready' }),
        FIXTURE_FRONTEND_HEALTHZ_BODY: body,
        FIXTURE_HTTP: '200',
        ...extra,
      },
    })
  }

  it('restores only the service that failed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-apply-'))
    const api = apply(dir, 'api', shaB, digestB, '2')
    const frontend = apply(dir, 'frontend', shaA, digestA, '3', { FIXTURE_API_READYZ_BODY: JSON.stringify({ status: 'not_ready' }) })
    const failed = apply(dir, 'frontend', shaC, digestC, '4', {
      FIXTURE_FRONTEND_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaB, deployment: 'cristian-pruebas' }),
    })
    expect(api.status).toBe(0)
    expect(frontend.status).toBe(0)
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain(`ROLLBACK_CONFIRMED frontend ${shaA}`)
    const frontendRecord = JSON.parse(readFileSync(join(dir, 'cristian/frontend.json'), 'utf8'))
    const apiRecord = JSON.parse(readFileSync(join(dir, 'cristian/api.json'), 'utf8'))
    expect(frontendRecord.current.gitSha).toBe(shaA)
    expect(frontendRecord.lastFailed.gitSha).toBe(shaC)
    expect(apiRecord.current.gitSha).toBe(shaB)
  })

  it('does not replace the last success when the image is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-missing-'))
    const failed = apply(dir, 'api', shaD, digestD, '8', { FIXTURE_PULL: 'absent' })
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('DEPLOY_FAILED_BEFORE_RECREATE api image_absent')
    expect(loadReleaseRecord(join(dir, 'cristian/api.json'), 'cristian', 'api').record.current).toBeNull()
  })

  it('rejects HTTP 503 and a repeated successful deployment stays idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-http-'))
    const unavailable = apply(dir, 'api', shaA, digestA, '6', { FIXTURE_HTTP: '503' })
    expect(unavailable.status).toBe(1)
    expect(unavailable.stderr).toContain('PROBE_FAILED api-healthz http_503')
    const ok = apply(dir, 'api', shaA, digestA, '6')
    const again = apply(dir, 'api', shaA, digestA, '6')
    expect(ok.status).toBe(0)
    expect(again.stdout).toContain('DEPLOY_CONFIRMED idempotent')
  })
})

describe('disposable docker release', () => {
  it('restores the container that the release record names', async () => {
    const result = await new Promise<{ status: number | null, stdout: string, stderr: string }>((resolve) => {
      const child = spawn('bash', ['scripts/deploy/disposable-release-drill.sh'], { cwd: root })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('close', (status) => resolve({ status, stdout, stderr }))
    })
    const output = `${result.stdout}\n${result.stderr}`
    if (output.includes('DOCKER_INTEGRATION_NOT_VERIFIED')) {
      throw new Error('DOCKER_INTEGRATION_NOT_VERIFIED')
    }
    expect(result.status, output).toBe(0)
    expect(output).toContain('DOCKER_RELEASE_RESTORED')
  }, 240000)
})

describe('workflow files', () => {
  it('keeps deploy workflows isolated', () => {
    const result = nodeScript('scripts/ci/check-workflow-isolation.mjs')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('workflow_isolation_ok')
  })
})

describe('canonical privileged paths', () => {
  it('rejects a symlink that resolves outside the privileged root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-path-'))
    const privileged = join(dir, 'priv')
    const checkout = join(dir, 'checkout')
    mkdirSync(join(privileged, 'bin'), { recursive: true })
    mkdirSync(checkout, { recursive: true })
    writeFileSync(join(privileged, 'bin/tool.sh'), 'echo ok\n')
    writeFileSync(join(checkout, 'secret.sh'), 'echo no\n')
    symlinkSync(join(checkout, 'secret.sh'), join(privileged, 'bin/escaped.sh'))
    process.env.DINAMIC_DEPLOY_FIXTURE = '1'
    process.env.DINAMIC_PRIVILEGED_ROOT = privileged
    try {
      expect(assertPrivileged(join(privileged, 'bin/tool.sh')).ok).toBe(true)
      expect(assertPrivileged(join(privileged, 'bin/escaped.sh')).ok).toBe(false)
      const cli = spawnSync('node', ['scripts/deploy/path-boundary.mjs', 'expect-privileged', join(privileged, 'bin/tool.sh')], {
        cwd: root, encoding: 'utf8', env: process.env,
      })
      expect(cli.status).toBe(0)
    } finally {
      delete process.env.DINAMIC_DEPLOY_FIXTURE
      delete process.env.DINAMIC_PRIVILEGED_ROOT
    }
  })
})

describe('release record semantics', () => {
  it('keeps current, previous, and the failed attempt distinct', () => {
    let record = commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaA, digestA, '1'))
    record = commitSuccess(record, release(shaB, digestB, '2'))
    expect(record.current.gitSha).toBe(shaB)
    expect(record.previous.gitSha).toBe(shaA)
    record = commitOperatorRollback(record)
    expect(record.current.gitSha).toBe(shaA)
    expect(record.previous.gitSha).toBe(shaB)
    record = commitSuccess(record, release(shaC, digestC, '3'))
    expect(record.current.gitSha).toBe(shaC)
    expect(record.previous.gitSha).toBe(shaA)
    const repeated = commitOperatorRollback(commitOperatorRollback(commitSuccess(commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaA, digestA, '1')), release(shaB, digestB, '2'))))
    expect(repeated.current.gitSha).toBe(shaB)
    expect(repeated.previous.gitSha).toBe(shaA)
    const changedDigest = commitSuccess(commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaA, digestA, '1')), release(shaA, digestB, '2'))
    expect(changedDigest.previous.digest).toBe(digestA)
    expect(planDeploy(changedDigest, release(shaA, digestB, '2')).action).toBe('idempotent')
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-commit-'))
    const paths = releasePaths(dir, 'cristian', 'api')
    saveRelease(paths, commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaA, digestA, '1')), { action: 'seed' })
    writeFileSync(`${paths.record}.999.tmp`, '{')
    expect(loadReleaseRecord(paths.record, 'cristian', 'api').record.current.gitSha).toBe(shaA)
  })
})

describe('operator rollback', () => {
  function rollback(dir: string, service: string, extra: Record<string, string> = {}) {
    return spawnSync('bash', ['scripts/deploy/cristian-remote-rollback.sh', service], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DINAMIC_DEPLOY_FIXTURE: '1',
        DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'),
        DINAMIC_RELEASE_STATE_DIR: dir,
        FIXTURE_API_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaA }),
        FIXTURE_API_READYZ_BODY: JSON.stringify({ status: 'ready' }),
        FIXTURE_FRONTEND_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaA, deployment: 'cristian-pruebas' }),
        ...extra,
      },
    })
  }

  function seed(dir: string, service: string) {
    const paths = releasePaths(dir, 'cristian', service)
    saveRelease(paths, commitSuccess(commitSuccess(emptyReleaseRecord('cristian', service), release(shaA, digestA, '1')), release(shaB, digestB, '2')), { action: 'seed' })
    return paths
  }

  it('restores only the requested service after the health check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-rollback-'))
    const log = join(dir, 'recreate.log')
    seed(dir, 'api')
    seed(dir, 'frontend')
    const api = rollback(dir, 'api', { FIXTURE_RECREATE_LOG: log })
    const frontend = rollback(dir, 'frontend', { FIXTURE_RECREATE_LOG: log })
    expect(api.status).toBe(0)
    expect(frontend.status).toBe(0)
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(['api', 'frontend'])
    expect(JSON.parse(readFileSync(join(dir, 'cristian/api.json'), 'utf8')).current.gitSha).toBe(shaA)
    expect(JSON.parse(readFileSync(join(dir, 'cristian/api.json'), 'utf8')).previous.gitSha).toBe(shaB)
    expect(JSON.parse(readFileSync(join(dir, 'cristian/frontend.json'), 'utf8')).current.gitSha).toBe(shaA)
  })

  it('does not commit when the image, digest, health, or recreate fails', () => {
    const failures: Record<string, string>[] = [
      { FIXTURE_IMAGE: 'absent' },
      { FIXTURE_DIGEST: 'bad' },
      { FIXTURE_RECREATE: 'fail' },
      { FIXTURE_API_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaC }) },
    ]
    for (const extra of failures) {
      const dir = mkdtempSync(join(tmpdir(), 'dinamic-rollback-fail-'))
      seed(dir, 'api')
      const failed = rollback(dir, 'api', extra)
      expect(failed.status).toBe(1)
      expect(failed.stderr).toContain('ROLLBACK_FAILED')
      const record = JSON.parse(readFileSync(join(dir, 'cristian/api.json'), 'utf8'))
      expect(record.current.gitSha).toBe(shaB)
      expect(record.previous.gitSha).toBe(shaA)
    }
  })

  it('rejects a missing previous release and a corrupt record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-rollback-empty-'))
    const empty = rollback(dir, 'api')
    expect(empty.status).toBe(1)
    expect(empty.stderr).toContain('no_previous_release')
    const corrupt = mkdtempSync(join(tmpdir(), 'dinamic-rollback-corrupt-'))
    mkdirSync(join(corrupt, 'cristian'), { recursive: true })
    writeFileSync(join(corrupt, 'cristian/api.json'), '{')
    const failed = rollback(corrupt, 'api')
    expect(failed.status).toBe(1)
    expect(readFileSync(join(corrupt, 'cristian/api.json'), 'utf8')).toBe('{')
  })
})

describe('service operation lock', () => {
  async function hold(lock: string) {
    mkdirSync(join(lock, '..'), { recursive: true })
    const ready = `${lock}.ready`
    const holder = spawn('python3', ['scripts/deploy/with-service-lock.py', lock, 'bash', '-c', 'printf ready > "$READY"; sleep 8'], {
      cwd: root,
      env: { ...process.env, READY: ready },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let holderError = ''
    holder.stderr?.on('data', (chunk) => { holderError += chunk })
    const started = Date.now()
    while (Date.now() - started < 2000) {
      try {
        if (readFileSync(ready, 'utf8') === 'ready') return holder
      } catch { /* the holder has not acquired the lock yet */ }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    if (holder.pid) holder.kill('SIGKILL')
    throw new Error(`lock was not acquired holder=${holder.exitCode} ${holderError}`)
  }

  it('keeps a second deploy and rollback out of the running operation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-flock-'))
    const paths = releasePaths(dir, 'cristian', 'api')
    saveRelease(paths, commitSuccess(commitSuccess(emptyReleaseRecord('cristian', 'api'), release(shaA, digestA, '1')), release(shaB, digestB, '2')), { action: 'seed' })
    const holder = await hold(join(dir, 'cristian/api.flock'))
    try {
      const deploy = spawnSync('bash', ['scripts/deploy/cristian-remote-apply.sh', 'api', shaC, digestC, '3'], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          DINAMIC_DEPLOY_FIXTURE: '1',
          DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'),
          DINAMIC_RELEASE_STATE_DIR: dir,
        },
      })
      const rolled = spawnSync('bash', ['scripts/deploy/cristian-remote-rollback.sh', 'api'], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          DINAMIC_DEPLOY_FIXTURE: '1',
          DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'),
          DINAMIC_RELEASE_STATE_DIR: dir,
        },
      })
      expect(deploy.status).toBe(1)
      expect(deploy.stderr).toContain('OPERATION_REJECTED locked')
      expect(rolled.status).toBe(1)
      expect(rolled.stderr).toContain('OPERATION_REJECTED locked')
      expect(JSON.parse(readFileSync(paths.record, 'utf8')).current.gitSha).toBe(shaB)
    } finally {
      if (holder.pid) holder.kill('SIGKILL')
    }
  })

  it('releases the lock when the holder is killed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-flock-kill-'))
    const lock = join(dir, 'cristian/api.flock')
    const holder = await hold(lock)
    holder.kill('SIGKILL')
    let released = spawnSync('python3', ['scripts/deploy/with-service-lock.py', lock, 'true'], { cwd: root, encoding: 'utf8' })
    const started = Date.now()
    while (released.status !== 0 && Date.now() - started < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      released = spawnSync('python3', ['scripts/deploy/with-service-lock.py', lock, 'true'], { cwd: root, encoding: 'utf8' })
    }
    expect(released.status).toBe(0)
  })
})

describe('privileged installation', () => {
  it('installs the loader and can run from another directory', () => {
    const dest = mkdtempSync(join(tmpdir(), 'dinamic-install-'))
    const state = mkdtempSync(join(tmpdir(), 'dinamic-install-state-'))
    const printed = spawnSync('bash', ['scripts/deploy/print-privileged-install.sh'], { cwd: root, encoding: 'utf8' })
    expect(printed.stdout).toContain('load-cristian-deploy-env.sh')
    expect(printed.stdout).toContain('PRIVILEGED_INSTALL_NOT_EXECUTED')
    const installed = spawnSync('bash', ['scripts/deploy/print-privileged-install.sh', '--apply-to', dest], { cwd: root, encoding: 'utf8' })
    expect(installed.status).toBe(0)
    expect(installed.stdout).toContain('PRIVILEGED_INSTALL_APPLIED')
    const ran = spawnSync('bash', [join(dest, 'bin/cristian-apply'), 'api', shaA, digestA, '1'], {
      cwd: '/tmp',
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DINAMIC_DEPLOY_FIXTURE: '1',
        DINAMIC_PRIVILEGED_ROOT: dest,
        DINAMIC_RELEASE_STATE_DIR: state,
        FIXTURE_API_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaA }),
        FIXTURE_API_READYZ_BODY: JSON.stringify({ status: 'ready' }),
        FIXTURE_HTTP: '200',
      },
    })
    expect(ran.status).toBe(0)
    expect(ran.stdout).toContain('DEPLOY_CONFIRMED api')
  })
})

describe('initial release adoption', () => {
  function container(overrides: Record<string, unknown> = {}) {
    return {
      Name: '/dinamic-clean-cristian-api',
      Config: {
        Env: [
          `APP_RELEASE_SHA=${shaA}`,
          'APP_DEPLOYMENT_ENV=cristian-pruebas',
          'EXPECTED_SUPABASE_PROJECT_REF=edruejzwwnixsjsadbgb',
        ],
      },
      State: { Health: { Status: 'healthy' } },
      NetworkSettings: { Ports: { '3001/tcp': [{ HostPort: '3006' }] } },
      ...overrides,
    }
  }

  function adopt(dir: string, containerFile: string, imageFile: string, extra: Record<string, string> = {}) {
    return spawnSync('bash', ['scripts/deploy/adopt-release.sh', 'cristian', 'api'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DINAMIC_DEPLOY_FIXTURE: '1',
        DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'),
        DINAMIC_RELEASE_STATE_DIR: dir,
        ADOPT_CONFIRM: 'adopt-running',
        ADOPT_RUN_ID: '15',
        FIXTURE_ADOPT_CONTAINER: containerFile,
        FIXTURE_ADOPT_IMAGE: imageFile,
        ...extra,
      },
    })
  }

  it('records a healthy container and blocks incomplete evidence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dinamic-adopt-'))
    const containerFile = join(dir, 'container.json')
    const imageFile = join(dir, 'image.json')
    writeFileSync(containerFile, JSON.stringify(container()))
    writeFileSync(imageFile, JSON.stringify({ RepoDigests: [`ghcr.io/example/api@${digestA}`] }))
    const recorded = adopt(dir, containerFile, imageFile)
    expect(recorded.status).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'cristian/api.json'), 'utf8')).current.gitSha).toBe(shaA)
    const again = adopt(dir, containerFile, imageFile)
    expect(again.stderr).toContain('already_initialized')
    writeFileSync(imageFile, JSON.stringify({ RepoDigests: [] }))
    const fresh = mkdtempSync(join(tmpdir(), 'dinamic-adopt-digest-'))
    expect(adopt(fresh, containerFile, imageFile).stderr).toContain('digest')
    writeFileSync(containerFile, JSON.stringify(container({ Config: { Env: ['APP_RELEASE_SHA=unknown', 'APP_DEPLOYMENT_ENV=cristian-pruebas', 'EXPECTED_SUPABASE_PROJECT_REF=edruejzwwnixsjsadbgb'] } })))
    writeFileSync(imageFile, JSON.stringify({ RepoDigests: [`ghcr.io/example/api@${digestA}`] }))
    expect(adopt(mkdtempSync(join(tmpdir(), 'dinamic-adopt-sha-')), containerFile, imageFile).stderr).toContain('sha')
    writeFileSync(containerFile, JSON.stringify(container({ State: { Health: { Status: 'unhealthy' } } })))
    expect(adopt(mkdtempSync(join(tmpdir(), 'dinamic-adopt-health-')), containerFile, imageFile).stderr).toContain('health')
    writeFileSync(containerFile, JSON.stringify(container({ Config: { Env: [`APP_RELEASE_SHA=${shaA}`, 'APP_DEPLOYMENT_ENV=production', 'EXPECTED_SUPABASE_PROJECT_REF=edruejzwwnixsjsadbgb'] } })))
    expect(adopt(mkdtempSync(join(tmpdir(), 'dinamic-adopt-env-')), containerFile, imageFile).stderr).toContain('environment')
    const missing = spawnSync('bash', ['scripts/deploy/adopt-release.sh', 'cristian', 'api'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        DINAMIC_DEPLOY_FIXTURE: '1',
        DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'),
        DINAMIC_RELEASE_STATE_DIR: mkdtempSync(join(tmpdir(), 'dinamic-adopt-missing-')),
        ADOPT_CONFIRM: 'adopt-running',
        ADOPT_RUN_ID: '15',
      },
    })
    expect(missing.stderr).toContain('missing')
    const production = spawnSync('bash', ['scripts/deploy/adopt-release.sh', 'production', 'api'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, DINAMIC_DEPLOY_FIXTURE: '1', DINAMIC_PRIVILEGED_ROOT: join(root, 'scripts/deploy'), ADOPT_CONFIRM: 'adopt-running', ADOPT_RUN_ID: '15' },
    })
    expect(production.stderr).toContain('production_authorization')
    expect(assessAdoption(null, {}, { name: 'missing', deploymentEnv: 'cristian-pruebas', port: '3006' }).reason).toBe('missing')
  })
})

describe('production deploy path', () => {
  it('commits only after probes and stops for a schema failure', () => {
    const dest = mkdtempSync(join(tmpdir(), 'dinamic-production-install-'))
    const installed = spawnSync('bash', ['scripts/deploy/print-privileged-install.sh', '--apply-to', dest], { cwd: root, encoding: 'utf8' })
    expect(installed.status).toBe(0)
    const compose = [
      'services:',
      '  api:',
      '    container_name: dinamic-clean-api',
      '    ports:',
      '      - "3005:3001"',
    ].join('\n')
    writeFileSync(join(dest, 'compose/reviewed.yml'), compose)
    const state = mkdtempSync(join(tmpdir(), 'dinamic-production-state-'))
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DINAMIC_DEPLOY_FIXTURE: '1',
      DINAMIC_PRIVILEGED_ROOT: dest,
      DINAMIC_RELEASE_STATE_DIR: state,
      PRODUCTION_COMPOSE_REVIEWED: 'operator-reviewed',
      PRODUCTION_COMPOSE_FILE: join(dest, 'compose/reviewed.yml'),
      FIXTURE_API_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaA }),
      FIXTURE_API_READYZ_BODY: JSON.stringify({ status: 'ready' }),
      FIXTURE_HTTP: '200',
    } as NodeJS.ProcessEnv
    const deployed = spawnSync('bash', [join(dest, 'bin/production-apply'), shaA, digestA, '4'], { cwd: '/tmp', encoding: 'utf8', env })
    expect(deployed.status).toBe(0)
    expect(deployed.stdout).toContain(`PRODUCTION_DEPLOY_CONFIRMED ${shaA}`)
    const schemaState = mkdtempSync(join(tmpdir(), 'dinamic-production-schema-'))
    const schema = spawnSync('bash', [join(dest, 'bin/production-apply'), shaB, digestB, '5'], {
      cwd: '/tmp',
      encoding: 'utf8',
      env: {
        ...env,
        DINAMIC_RELEASE_STATE_DIR: schemaState,
        FIXTURE_API_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaB }),
        FIXTURE_API_READYZ_BODY: JSON.stringify({ status: 'not_ready', reason: 'phase2d_schema_incompatible' }),
      } as NodeJS.ProcessEnv,
    })
    expect(schema.status).toBe(1)
    expect(schema.stderr).toContain('PRODUCTION_ROLLBACK_REQUIRES_HUMAN')
    expect(loadReleaseRecord(join(schemaState, 'production/api.json'), 'production', 'api').record.current).toBeNull()
    const paths = releasePaths(state, 'production', 'api')
    saveRelease(paths, commitSuccess(loadReleaseRecord(paths.record, 'production', 'api').record, release(shaB, digestB, '6')), { action: 'seed' })
    const log = join(state, 'recreate.log')
    const rolled = spawnSync('bash', [join(dest, 'bin/production-rollback')], {
      cwd: '/tmp',
      encoding: 'utf8',
      env: {
        ...env,
        FIXTURE_RECREATE_LOG: log,
        FIXTURE_API_HEALTHZ_BODY: JSON.stringify({ status: 'ok', release: shaA }),
      } as NodeJS.ProcessEnv,
    })
    expect(rolled.status).toBe(0)
    expect(readFileSync(log, 'utf8').trim()).toBe('api')
    const record = JSON.parse(readFileSync(paths.record, 'utf8'))
    expect(record.current.gitSha).toBe(shaA)
    expect(record.previous.gitSha).toBe(shaB)
    writeFileSync(join(state, 'schema-incompatible'), '')
    const blocked = spawnSync('bash', [join(dest, 'bin/production-rollback')], { cwd: '/tmp', encoding: 'utf8', env })
    expect(blocked.stderr).toContain('PRODUCTION_ROLLBACK_REQUIRES_HUMAN')
    expect(readFileSync(join(root, 'scripts/deploy/production-remote-apply.sh'), 'utf8')).not.toContain('remote_execution_not_enabled')
  })
})
