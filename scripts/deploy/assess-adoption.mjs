/**
 * Decides whether a running container may be recorded without recreating it.
 * A missing registry digest is a manual step, not a value to invent.
 */
const SHA = /^[0-9a-f]{40}$/
const TEST_REF = 'edruejzwwnixsjsadbgb'

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function environmentMap(container) {
  return Object.fromEntries((container?.Config?.Env ?? []).filter((item) => item.includes('=')).map((item) => {
    const index = item.indexOf('=')
    return [item.slice(0, index), item.slice(index + 1)]
  }))
}

function hostPorts(container) {
  const ports = container?.NetworkSettings?.Ports ?? {}
  const values = []
  for (const entries of Object.values(ports)) {
    for (const entry of entries ?? []) values.push(String(entry.HostPort))
  }
  return values
}

export function assessAdoption(containerInput, imageInput, expected) {
  const container = first(containerInput)
  const image = first(imageInput)
  if (!container) return { ok: false, reason: 'missing', instruction: 'ADOPT_MANUAL container was not found' }
  const name = String(container.Name ?? '').replace(/^\//, '')
  if (name !== expected.name) return { ok: false, reason: 'name', instruction: 'ADOPT_MANUAL container name does not match this environment' }
  const env = environmentMap(container)
  if (!SHA.test(env.APP_RELEASE_SHA ?? '')) {
    return { ok: false, reason: 'sha', instruction: 'ADOPT_MANUAL the container does not report a 40-character release SHA' }
  }
  if (env.APP_DEPLOYMENT_ENV !== expected.deploymentEnv) {
    return { ok: false, reason: 'environment', instruction: 'ADOPT_MANUAL the container environment does not match this adoption target' }
  }
  if (expected.deploymentEnv === 'cristian-pruebas' && env.EXPECTED_SUPABASE_PROJECT_REF !== TEST_REF) {
    return { ok: false, reason: 'supabase', instruction: 'ADOPT_MANUAL Supabase Test identity was not confirmed on the container' }
  }
  if (expected.deploymentEnv === 'production' && (env.EXPECTED_SUPABASE_PROJECT_REF === TEST_REF || env.APP_DEPLOYMENT_ENV === 'cristian-pruebas')) {
    return { ok: false, reason: 'environment', instruction: 'ADOPT_MANUAL production adoption saw the Test project' }
  }
  if (container.State?.Health?.Status !== 'healthy') {
    return { ok: false, reason: 'health', instruction: 'ADOPT_MANUAL the container is not healthy' }
  }
  if (!hostPorts(container).includes(String(expected.port))) {
    return { ok: false, reason: 'port', instruction: 'ADOPT_MANUAL the published port does not match' }
  }
  const found = (image?.RepoDigests ?? []).find((item) => /@sha256:[a-f0-9]{64}$/.test(String(item)))
  if (!found) {
    return { ok: false, reason: 'digest', instruction: 'ADOPT_MANUAL the local image has no registry digest. Do not invent one.' }
  }
  return { ok: true, reason: '', sha: env.APP_RELEASE_SHA, digest: found.slice(found.lastIndexOf('@') + 1), image: found }
}

const invoked = process.argv[1]?.endsWith('assess-adoption.mjs')
if (invoked) {
  const { readFileSync } = await import('node:fs')
  const container = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const image = JSON.parse(readFileSync(process.argv[3], 'utf8'))
  const decision = assessAdoption(container, image, {
    name: process.env.ADOPT_CONTAINER,
    deploymentEnv: process.env.ADOPT_DEPLOYMENT_ENV,
    port: process.env.ADOPT_PORT,
  })
  if (!decision.ok) {
    console.error(`ADOPT_REJECTED ${decision.reason}`)
    console.error(decision.instruction)
    process.exit(1)
  }
  console.log(`ADOPT_OK ${decision.sha} ${decision.digest} ${decision.image}`)
}
