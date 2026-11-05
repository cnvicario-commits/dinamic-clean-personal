import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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
import { classifyDeploymentPath } from '../../scripts/deploy/path-boundary.mjs'
import {
  commitSuccess,
  digestMatches,
  emptyReleaseRecord,
  loadReleaseRecord,
  planDeploy,
  releasePaths,
  saveRelease,
} from '../../scripts/deploy/release-state.mjs'

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
    expect(readSuccessfulCiRun({ workflow_runs: [{ id: 20, head_sha: shaA, head_branch: 'cristian-pruebas', event: 'push', conclusion: 'success' }] }, { sha: shaA, branch: 'cristian-pruebas' }).runId).toBe('20')
    expect(readSuccessfulCiRun({ workflow_runs: [{ id: 20, head_sha: shaC, head_branch: 'cristian-pruebas', event: 'push', conclusion: 'success' }] }, { sha: shaA, branch: 'cristian-pruebas' }).reason).toBe('sha')
    expect(readSuccessfulCiRun({ workflow_runs: [] }, { sha: shaA, branch: 'cristian-pruebas' }).reason).toBe('missing')
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

describe('workflow files', () => {
  it('keeps deploy workflows isolated', () => {
    const result = nodeScript('scripts/ci/check-workflow-isolation.mjs')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('workflow_isolation_ok')
  })
})
