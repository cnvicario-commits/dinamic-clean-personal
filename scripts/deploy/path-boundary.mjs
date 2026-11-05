/**
 * Distinguishes the production checkout from the Cristian checkout.
 * `/opt/dinamic-clean-cristian` is not inside `/opt/dinamic-clean`.
 */
import path from 'node:path'

export function classifyDeploymentPath(input) {
  const resolved = path.resolve(String(input ?? ''))
  if (resolved === '/opt/dinamic-clean-privileged' || resolved.startsWith('/opt/dinamic-clean-privileged/')) return 'privileged'
  if (resolved === '/opt/dinamic-clean' || resolved.startsWith('/opt/dinamic-clean/')) return 'production'
  if (resolved === '/opt/dinamic-clean-cristian' || resolved.startsWith('/opt/dinamic-clean-cristian/')) return 'cristian-checkout'
  return 'allowed'
}

const invoked = process.argv[1]?.endsWith('path-boundary.mjs')
if (invoked) {
  const kind = classifyDeploymentPath(process.argv[2])
  if (kind === 'allowed') {
    console.log('PATH_ALLOWED')
  } else {
    console.error(`PATH_REJECTED ${kind}`)
    process.exit(1)
  }
}
