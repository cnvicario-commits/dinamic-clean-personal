/**
 * Admission check for a manual production API deploy.
 * It does not deploy and it does not read secrets.
 */
const SHA = /^[0-9a-f]{40}$/

export function evaluateProductionDeployGate(input) {
  if (input.ref !== 'refs/heads/main') return { ok: false, reason: 'ref' }
  if (input.confirm !== 'deploy-production') return { ok: false, reason: 'confirm' }
  if (input.enabled !== 'true') return { ok: false, reason: 'disabled' }
  if (!SHA.test(input.sha ?? '')) return { ok: false, reason: 'sha' }
  if (input.ciSha !== input.sha || input.ciBranch !== 'main' || input.ciEvent !== 'push' || input.ciConclusion !== 'success') {
    return { ok: false, reason: 'ci' }
  }
  return { ok: true, reason: '' }
}

const invoked = process.argv[1]?.endsWith('evaluate-production-deploy-gate.mjs')
if (invoked) {
  const decision = evaluateProductionDeployGate({
    ref: process.env.REF,
    confirm: process.env.CONFIRM,
    enabled: process.env.ENABLED,
    sha: process.env.GITHUB_SHA,
    ciSha: process.env.CI_SHA,
    ciBranch: process.env.CI_BRANCH,
    ciEvent: process.env.CI_EVENT,
    ciConclusion: process.env.CI_CONCLUSION,
  })
  if (!decision.ok) {
    const label = decision.reason === 'disabled' ? 'PRODUCTION_DEPLOY_DISABLED'
      : decision.reason === 'confirm' ? 'PRODUCTION_CONFIRMATION_REJECTED'
        : decision.reason === 'ref' ? 'PRODUCTION_REF_REJECTED'
          : 'PRODUCTION_DEPLOY_REJECTED'
    console.error(`${label} ${decision.reason}`)
    process.exit(1)
  }
  console.log('PRODUCTION_DEPLOY_ADMITTED')
}
