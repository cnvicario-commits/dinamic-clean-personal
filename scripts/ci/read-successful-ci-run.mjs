/**
 * Reads one GitHub Actions list response and accepts only the expected run.
 */
export function readSuccessfulCiRun(payload, expected) {
  const run = payload?.workflow_runs?.[0]
  if (!run) return { ok: false, reason: 'missing' }
  if (run.head_sha !== expected.sha) return { ok: false, reason: 'sha' }
  if (run.head_branch !== expected.branch) return { ok: false, reason: 'branch' }
  if (run.event !== 'push') return { ok: false, reason: 'event' }
  if (run.conclusion !== 'success') return { ok: false, reason: 'conclusion' }
  if (!/^[1-9][0-9]*$/.test(String(run.id ?? ''))) return { ok: false, reason: 'run_id' }
  return { ok: true, reason: '', sha: run.head_sha, runId: String(run.id) }
}

const invoked = process.argv[1]?.endsWith('read-successful-ci-run.mjs')
if (invoked) {
  const { readFileSync } = await import('node:fs')
  const payload = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const decision = readSuccessfulCiRun(payload, { sha: process.env.EXPECTED_SHA, branch: process.env.EXPECTED_BRANCH })
  if (!decision.ok) {
    console.error(`CI_RUN_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${decision.runId}\nsha=${decision.sha}\n`)
  }
  console.log(`CI_RUN_ACCEPTED ${decision.runId}`)
}
