/**
 * Classifies deployment paths and checks that a file is really inside
 * the directory the caller expects. A textual prefix is not enough once
 * the file exists: the check uses the canonical path.
 */
import fs from 'node:fs'
import path from 'node:path'

export const PRIVILEGED_ROOT = '/opt/dinamic-clean-privileged'
export const PRODUCTION_ROOT = '/opt/dinamic-clean'
export const CRISTIAN_ROOT = '/opt/dinamic-clean-cristian'

function containsTraversal(input) {
  return String(input ?? '').split(/[\\/]/).includes('..')
}

export function classifyDeploymentPath(input) {
  const resolved = path.resolve(String(input ?? ''))
  if (resolved === PRIVILEGED_ROOT || resolved.startsWith(`${PRIVILEGED_ROOT}/`)) return 'privileged'
  if (resolved === PRODUCTION_ROOT || resolved.startsWith(`${PRODUCTION_ROOT}/`)) return 'production'
  if (resolved === CRISTIAN_ROOT || resolved.startsWith(`${CRISTIAN_ROOT}/`)) return 'cristian-checkout'
  return 'allowed'
}

export function privilegedRoot() {
  const override = process.env.DINAMIC_PRIVILEGED_ROOT
  const overrideAllowed = process.env.DINAMIC_DEPLOY_FIXTURE === '1' || process.env.DINAMIC_DISPOSABLE_DOCKER === '1'
  if (overrideAllowed && override) {
    const root = path.resolve(override)
    const kind = classifyDeploymentPath(root)
    if (kind === 'production' || kind === 'cristian-checkout') return ''
    return fs.existsSync(root) ? fs.realpathSync(root) : root
  }
  return PRIVILEGED_ROOT
}

export function canonicalizeDeploymentPath(input) {
  const raw = String(input ?? '')
  if (!raw || raw.includes('\0') || containsTraversal(raw)) return { ok: false, reason: 'traversal' }
  const resolved = path.resolve(raw)
  if (fs.existsSync(resolved)) {
    return { ok: true, path: fs.realpathSync(resolved) }
  }
  const parent = path.dirname(resolved)
  if (fs.existsSync(parent)) {
    return { ok: true, path: path.join(fs.realpathSync(parent), path.basename(resolved)) }
  }
  return { ok: true, path: resolved }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

export function assertPrivileged(input) {
  const root = privilegedRoot()
  if (!root) return { ok: false, reason: 'privileged_root' }
  const canonical = canonicalizeDeploymentPath(input)
  if (!canonical.ok) return canonical
  if (!isInside(root, canonical.path)) return { ok: false, reason: 'outside', path: canonical.path }
  return { ok: true, path: canonical.path }
}

export function assertNotMutableCheckout(input) {
  const canonical = canonicalizeDeploymentPath(input)
  if (!canonical.ok) return canonical
  const kind = classifyDeploymentPath(canonical.path)
  if (kind === 'production' || kind === 'cristian-checkout') return { ok: false, reason: kind, path: canonical.path }
  return { ok: true, path: canonical.path }
}

function printResult(decision, label) {
  if (!decision.ok) {
    console.error(`PATH_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  console.log(`${label} ${decision.path}`)
}

const invoked = process.argv[1]?.endsWith('path-boundary.mjs')
if (invoked) {
  const [mode, target] = process.argv.slice(2)
  if (mode === 'classify') {
    console.log(classifyDeploymentPath(target))
  } else if (mode === 'expect-privileged') {
    printResult(assertPrivileged(target), 'PATH_PRIVILEGED')
  } else if (mode === 'reject-checkout') {
    printResult(assertNotMutableCheckout(target), 'PATH_ACCEPTED')
  } else if (!mode || mode === target) {
    console.error('PATH_REJECTED usage')
    process.exit(2)
  } else {
    console.error('PATH_REJECTED usage')
    process.exit(2)
  }
}
