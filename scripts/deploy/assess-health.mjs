/**
 * Contracts for the published health endpoints.
 * API /healthz is `{ status: "ok", release }`.
 * API /readyz is `{ status: "ready" }` or HTTP 503 `{ status: "not_ready" }`.
 * Frontend /api/healthz does not depend on the API.
 */

export function schemaBlocksAutomaticRollback(body) {
  try {
    const parsed = JSON.parse(String(body ?? ''))
    return parsed?.status === 'not_ready' && /schema/i.test(String(parsed.reason ?? ''))
  } catch {
    return false
  }
}

export function assessHealthPayload(kind, body, expected = {}) {
  let parsed
  try {
    parsed = JSON.parse(String(body ?? ''))
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid_json' }
  }
  if (kind === 'api-healthz') {
    if (parsed.status !== 'ok') return { ok: false, reason: 'status' }
    if (parsed.release !== expected.sha) return { ok: false, reason: 'release' }
    return { ok: true, reason: '' }
  }
  if (kind === 'api-readyz') {
    if (parsed.status !== 'ready') return { ok: false, reason: 'status' }
    return { ok: true, reason: '' }
  }
  if (kind === 'frontend-healthz') {
    if (parsed.status !== 'ok') return { ok: false, reason: 'status' }
    if (parsed.release !== expected.sha) return { ok: false, reason: 'release' }
    if (parsed.deployment !== 'cristian-pruebas') return { ok: false, reason: 'deployment' }
    return { ok: true, reason: '' }
  }
  return { ok: false, reason: 'kind' }
}

export async function probeUrl(url, options = {}) {
  const attempts = options.attempts ?? 3
  const timeoutMs = options.timeoutMs ?? 3000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  let reason = 'network'
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
      const body = await response.text()
      if (schemaBlocksAutomaticRollback(body)) {
        return { ok: false, reason: 'schema_incompatible', status: response.status, body, attempt }
      }
      if (response.status !== 200) {
        reason = `http_${response.status}`
        continue
      }
      return { ok: true, reason: '', status: response.status, body, attempt }
    } catch (error) {
      reason = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network'
    }
  }
  return { ok: false, reason, status: 0, body: '', attempt: attempts }
}

export async function probeRelease(kind, url, expected = {}, options = {}) {
  const probed = await probeUrl(url, options)
  if (!probed.ok) return { ok: false, reason: probed.reason, attempt: probed.attempt }
  const assessed = assessHealthPayload(kind, probed.body, expected)
  return { ...assessed, attempt: probed.attempt }
}

async function fixtureProbe(kind) {
  const body = process.env[`FIXTURE_${kind.toUpperCase().replaceAll('-', '_')}_BODY`] ?? ''
  const status = Number(process.env.FIXTURE_HTTP || '200')
  if (process.env.FIXTURE_TIMEOUT === '1') return { ok: false, reason: 'timeout', attempt: 3 }
  if (schemaBlocksAutomaticRollback(body)) return { ok: false, reason: 'schema_incompatible', attempt: 1 }
  if (status !== 200) return { ok: false, reason: `http_${status}`, attempt: 1 }
  return assessHealthPayload(kind, body, { sha: process.env.RELEASE_SHA })
}

const invoked = process.argv[1]?.endsWith('assess-health.mjs')
if (invoked) {
  const kind = process.argv[2]
  const url = process.argv[3]
  const decision = process.env.DINAMIC_DEPLOY_FIXTURE === '1'
    ? await fixtureProbe(kind)
    : await probeRelease(kind, url, { sha: process.env.RELEASE_SHA }, { attempts: Number(process.env.PROBE_ATTEMPTS || '3'), timeoutMs: 3000 })
  if (!decision.ok) {
    console.error(`PROBE_FAILED ${kind} ${decision.reason}`)
    process.exit(1)
  }
  console.log(`PROBE_OK ${kind}`)
}
