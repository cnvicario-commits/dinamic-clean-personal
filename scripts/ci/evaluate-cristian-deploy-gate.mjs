/**
 * Decides whether a Cristian deploy may start.
 * A failed or foreign CI run is not a deploy authorization.
 */
const REPOSITORY = 'cnvicario-commits/dinamic-clean-personal'
const SHA = /^[0-9a-f]{40}$/

export function evaluateCristianDeployGate(input) {
  if (input.repository !== REPOSITORY) return { action: 'reject', reason: 'repository' }
  if (!SHA.test(input.headSha ?? '')) return { action: 'reject', reason: 'sha' }
  if (input.eventName === 'workflow_run') {
    if (input.headRepository !== REPOSITORY) return { action: 'reject', reason: 'fork' }
    if (input.workflowName !== 'ci') return { action: 'reject', reason: 'workflow' }
    if (input.triggeringEvent !== 'push') return { action: 'skip', reason: 'event' }
    if (input.headBranch !== 'cristian-pruebas') return { action: 'skip', reason: 'branch' }
    if (input.conclusion !== 'success') return { action: 'skip', reason: 'conclusion' }
    return { action: 'deploy', reason: '', sha: input.headSha }
  }
  if (input.eventName === 'workflow_dispatch') {
    if (input.ref !== 'refs/heads/main') return { action: 'reject', reason: 'ref' }
    if (input.ciHeadSha !== input.headSha) return { action: 'reject', reason: 'sha' }
    if (input.ciBranch !== 'cristian-pruebas') return { action: 'reject', reason: 'branch' }
    if (input.ciEvent !== 'push') return { action: 'reject', reason: 'event' }
    if (input.ciConclusion !== 'success') return { action: 'skip', reason: 'conclusion' }
    return { action: 'deploy', reason: '', sha: input.headSha }
  }
  return { action: 'reject', reason: 'event_name' }
}

function fromEnv(env = process.env) {
  return {
    eventName: env.EVENT_NAME,
    repository: env.REPOSITORY,
    headRepository: env.HEAD_REPOSITORY,
    workflowName: env.WORKFLOW_NAME,
    conclusion: env.CONCLUSION,
    triggeringEvent: env.TRIGGERING_EVENT,
    headBranch: env.HEAD_BRANCH,
    headSha: env.HEAD_SHA || env.INPUT_SHA,
    ref: env.REF,
    ciHeadSha: env.CI_HEAD_SHA,
    ciBranch: env.CI_BRANCH,
    ciEvent: env.CI_EVENT,
    ciConclusion: env.CI_CONCLUSION,
  }
}

const invoked = process.argv[1]?.endsWith('evaluate-cristian-deploy-gate.mjs')
if (invoked) {
  const decision = evaluateCristianDeployGate(fromEnv())
  const line = `deploy=${decision.action === 'deploy' ? 'true' : 'false'}\nsha=${decision.sha || ''}\nreason=${decision.reason}\n`
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_OUTPUT, line)
  }
  if (decision.action === 'reject') {
    console.error(`CRISTIAN_DEPLOY_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  console.log(decision.action === 'deploy' ? `CRISTIAN_DEPLOY_AUTHORIZED ${decision.sha}` : `CRISTIAN_DEPLOY_SKIPPED ${decision.reason}`)
}
