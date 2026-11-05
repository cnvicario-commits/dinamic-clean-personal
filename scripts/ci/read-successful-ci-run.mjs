/**
 * Selects a real successful CI run from a GitHub Actions list response.
 * The caller must pass these fields to the deploy gate. A supplied SHA is not proof.
 */
function runRepository(run) {
  return run?.head_repository?.full_name || run?.repository?.full_name || ''
}

export function readSuccessfulCiRun(payload, expected) {
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : null
  if (!runs || runs.length === 0) return { ok: false, reason: 'missing' }
  const matches = runs.filter((run) => {
    if (run.head_sha !== expected.sha) return false
    if (run.head_branch !== expected.branch) return false
    if (run.event !== 'push') return false
    if (run.conclusion !== 'success') return false
    if (!/^[1-9][0-9]*$/.test(String(run.id ?? ''))) return false
    const repository = runRepository(run)
    if (expected.repository && repository !== expected.repository) return false
    return true
  })
  if (matches.length === 0) {
    const run = runs[0]
    if (run.head_sha !== expected.sha) return { ok: false, reason: 'sha' }
    if (run.head_branch !== expected.branch) return { ok: false, reason: 'branch' }
    if (run.event !== 'push') return { ok: false, reason: 'event' }
    if (run.conclusion !== 'success') return { ok: false, reason: 'conclusion' }
    if (expected.repository && runRepository(run) !== expected.repository) return { ok: false, reason: 'fork' }
    return { ok: false, reason: 'missing' }
  }
  matches.sort((left, right) => Number(right.id) - Number(left.id))
  const run = matches[0]
  return {
    ok: true,
    reason: '',
    sha: run.head_sha,
    runId: String(run.id),
    branch: run.head_branch,
    event: run.event,
    conclusion: run.conclusion,
    repository: runRepository(run),
  }
}

const invoked = process.argv[1]?.endsWith('read-successful-ci-run.mjs')
if (invoked) {
  const { appendFileSync, readFileSync } = await import('node:fs')
  const payload = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const decision = readSuccessfulCiRun(payload, {
    sha: process.env.EXPECTED_SHA,
    branch: process.env.EXPECTED_BRANCH,
    repository: process.env.EXPECTED_REPOSITORY,
  })
  if (!decision.ok) {
    console.error(`CI_RUN_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, [
      `run_id=${decision.runId}`,
      `sha=${decision.sha}`,
      `branch=${decision.branch}`,
      `event=${decision.event}`,
      `conclusion=${decision.conclusion}`,
      `repository=${decision.repository}`,
      '',
    ].join('\n'))
  }
  console.log(`CI_RUN_ACCEPTED ${decision.runId}`)
}
