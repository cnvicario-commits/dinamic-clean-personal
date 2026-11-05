/**
 * Static checks for a production API Compose file.
 * Passing these checks does not prove the file is the one running on the VPS.
 */
import { classifyDeploymentPath } from './path-boundary.mjs'

const TEST_REF = 'edruejzwwnixsjsadbgb'

export function assessProductionCompose(text, expected) {
  const reasons = []
  const source = String(text ?? '')
  if (classifyDeploymentPath(expected.composePath) !== 'privileged') reasons.push('compose_path')
  if (source.includes(TEST_REF) || source.includes('cristian-pruebas')) reasons.push('cristian_config')
  if (/published:\s*"?(3006|8086)"?/.test(source) || /(^|[\s"':])(3006|8086):3001/.test(source)) reasons.push('foreign_port')
  if (!/3005/.test(source)) reasons.push('port')
  if (!/(^|\n)\s*api:/.test(source)) reasons.push('service')
  if (!source.includes('container_name: dinamic-clean-api')) reasons.push('container')
  if (source.includes('privileged: true') || source.includes('docker.sock') || source.includes('network_mode: host')) reasons.push('privilege')
  if (source.includes(':latest')) reasons.push('latest')
  return reasons.length === 0 ? { ok: true, reason: '' } : { ok: false, reason: reasons[0], reasons }
}

const invoked = process.argv[1]?.endsWith('assess-production-compose.mjs')
if (invoked) {
  const { readFileSync } = await import('node:fs')
  const decision = assessProductionCompose(readFileSync(process.argv[2], 'utf8'), {
    composePath: process.argv[2],
    sha: process.env.RELEASE_SHA,
    digest: process.env.RELEASE_DIGEST,
  })
  if (!decision.ok) {
    console.error(`PRODUCTION_COMPOSE_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  console.log('PRODUCTION_COMPOSE_ACCEPTED')
}
