/**
 * Static checks for the CI/CD workflow files. Does not call GitHub.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (name) => readFileSync(join(root, '.github/workflows', name), 'utf8')
const failures = []
const reject = (reason) => failures.push(reason)

const ci = read('ci.yml')
const cristian = read('cd-cristian.yml')
const production = read('cd-production.yml')
const migrations = read('cd-migrations.yml')
const productionRef = 'biectbcujabpjhinouil'

if (!ci.includes('contents: read')) reject('ci_permissions')
if (ci.includes('environment:')) reject('ci_environment')
if (/\b(ssh|docker login|ghcr\.io)\b/.test(ci)) reject('ci_deploy_command')

if (cristian.includes('environment: production')) reject('cristian_production_environment')
if (cristian.includes(productionRef)) reject('cristian_production_ref')
if (cristian.includes(':latest')) reject('cristian_latest')
if (!cristian.includes('workflow_run:')) reject('cristian_workflow_run')
if (/\n {2}push:/.test(cristian)) reject('cristian_push_trigger')
if (!cristian.includes('evaluate-cristian-deploy-gate.mjs')) reject('cristian_gate')
if (!cristian.includes('read-successful-ci-run.mjs')) reject('cristian_ci_lookup')
if (cristian.includes('CI_CONCLUSION=success') || cristian.includes('CI_CONCLUSION="success"')) reject('cristian_hardcoded_ci')
if (!cristian.includes('environment: cristian-pruebas')) reject('cristian_environment')
if (cristian.includes('apply-forward-migrations.sh')) reject('cristian_auto_migration')
if (cristian.includes('/opt/dinamic-clean/')) reject('cristian_production_path')

const productionGate = readFileSync(join(root, 'scripts/ci/evaluate-production-deploy-gate.mjs'), 'utf8')
if (!production.includes('workflow_dispatch:')) reject('production_dispatch')
if (production.includes('\n  push:') || production.includes('\n    branches:')) reject('production_branch_trigger')
if (!production.includes('evaluate-production-deploy-gate.mjs')) reject('production_gate')
if (production.includes('CI_CONCLUSION=success') || production.includes('CI_CONCLUSION="success"')) reject('production_hardcoded_ci')
if (!productionGate.includes('PRODUCTION_REF_REJECTED')) reject('production_ref_guard')
if (!productionGate.includes('refs/heads/main')) reject('production_ref_guard')
if (!production.includes('deploy-production')) reject('production_confirmation')
if (!productionGate.includes('PRODUCTION_DEPLOY_DISABLED')) reject('production_activation')
if (!production.includes('environment: production')) reject('production_environment')
if (production.includes(':latest')) reject('production_latest')
if (production.includes('apply-forward-migrations.sh')) reject('production_auto_migration')
if (production.includes('vercel deploy') || production.includes('vercel build')) reject('production_second_vercel_pipeline')

if (!migrations.includes('workflow_dispatch:')) reject('migrations_dispatch')
if (migrations.includes('branches:')) reject('migrations_branch_trigger')
if (!migrations.includes('environment: cristian-pruebas')) reject('migrations_environment')
if (migrations.includes('environment: production')) reject('migrations_production_environment')
if (!migrations.includes('apply-forward-migrations.sh')) reject('migrations_runner')
if (migrations.includes('DINAMIC_ALLOW_PRODUCTION')) reject('migrations_bypass')

if (failures.length > 0) {
  for (const reason of failures) console.error(`WORKFLOW_ISOLATION_REJECTED ${reason}`)
  process.exit(1)
}
console.log('workflow_isolation_ok')
