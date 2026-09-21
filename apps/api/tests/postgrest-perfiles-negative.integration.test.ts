/**
 * Opt-in PostgREST negative tests for public.perfiles (Phase 2D).
 *
 * Required:
 *   RUN_SUPABASE_INTEGRATION=1
 *   NODE_ENV=test
 *   EXPECTED_SUPABASE_TEST_PROJECT_REF=<exact test project ref>
 *   SUPABASE_URL, DATABASE_URL (same project)
 *   SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   POSTGREST_TEST_USER_JWT — valid authenticated user JWT
 *   POSTGREST_TEST_PROFILE_ID — uuid of that user's perfiles row (synthetic TEST)
 *   SUPABASE_SERVICE_ROLE_KEY — TEST verifier reads only
 *
 * Flow: prove JWT works (SELECT) → attempt mutations → verify row state unchanged.
 * A lone 401/400/404 without prior SELECT proof / state check does NOT count.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'
const jwt = (process.env.POSTGREST_TEST_USER_JWT ?? '').trim()
const profileId = (process.env.POSTGREST_TEST_PROFILE_ID ?? '').trim()
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const baseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const canRun = enabled && Boolean(jwt && profileId && anonKey && baseUrl && serviceKey)

async function rest(
  method: string,
  pathAndQuery: string,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  const res = await fetch(`${baseUrl}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, text: await res.text() }
}

describe.skipIf(!canRun)('PostgREST perfiles negatives (Phase 2D)', () => {
  let verifier: ReturnType<typeof createClient>
  let baselineRol: string | null
  let baselineNombre: string | null

  beforeAll(async () => {
    assertDinamicCleanTestTarget({ requireJwt: true })
    verifier = createClient(baseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { status, text } = await rest(
      'GET',
      `perfiles?id=eq.${profileId}&select=id,rol,nombre_completo`,
    )
    expect(status, 'JWT must authenticate for SELECT before negatives').toBe(200)
    const rows = JSON.parse(text) as Array<{
      id: string
      rol: string
      nombre_completo: string | null
    }>
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0]?.id).toBe(profileId)
    baselineRol = rows[0]?.rol ?? null
    baselineNombre = rows[0]?.nombre_completo ?? null
  })

  async function readViaVerifier() {
    const { data, error } = await verifier
      .from('perfiles')
      .select('id, rol, nombre_completo')
      .eq('id', profileId)
      .maybeSingle()
    if (error) throw new Error('verifier read failed')
    return data
  }

  it('UPDATE own rol → denied effect (row unchanged)', async () => {
    assertDinamicCleanTestTarget({ requireJwt: true })
    const before = await readViaVerifier()
    const { status } = await rest('PATCH', `perfiles?id=eq.${profileId}`, { rol: 'admin' })
    expect(status).not.toBe(404)
    expect(status).not.toBe(400)
    const after = await readViaVerifier()
    expect(after?.rol).toBe(before?.rol)
    expect(after?.rol).toBe(baselineRol)
    expect(after?.rol).not.toBe('admin')
  })

  it('UPDATE another profile → no change to target', async () => {
    assertDinamicCleanTestTarget({ requireJwt: true })
    const otherId = '00000000-0000-4000-8000-000000000001'
    const { data: before } = await verifier
      .from('perfiles')
      .select('nombre_completo')
      .eq('id', otherId)
      .maybeSingle()
    const { status } = await rest('PATCH', `perfiles?id=eq.${otherId}`, {
      nombre_completo: 'Hacked-Phase2D',
    })
    expect(status).not.toBe(404)
    expect(status).not.toBe(400)
    const { data: after } = await verifier
      .from('perfiles')
      .select('nombre_completo')
      .eq('id', otherId)
      .maybeSingle()
    expect(after?.nombre_completo ?? null).toBe(before?.nombre_completo ?? null)
  })

  it('INSERT arbitrary perfil → DENY and no new row', async () => {
    assertDinamicCleanTestTarget({ requireJwt: true })
    const injected = '00000000-0000-4000-8000-000000000099'
    const { status } = await rest('POST', 'perfiles', {
      id: injected,
      nombre_completo: 'Injected',
      rol: 'admin',
    })
    expect(status).not.toBe(404)
    expect([200, 201].includes(status)).toBe(false)
    const { data } = await verifier.from('perfiles').select('id').eq('id', injected).maybeSingle()
    expect(data).toBeNull()
  })

  it('DELETE profile → DENY and row remains', async () => {
    assertDinamicCleanTestTarget({ requireJwt: true })
    const { status } = await rest('DELETE', `perfiles?id=eq.${profileId}`)
    expect(status).not.toBe(404)
    expect(status).not.toBe(400)
    const after = await readViaVerifier()
    expect(after?.id).toBe(profileId)
    expect(after?.nombre_completo).toBe(baselineNombre)
  })
})

describe('PostgREST negative gate', () => {
  it('records NOT EXECUTED when opt-in incomplete', () => {
    if (canRun) {
      expect(process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF).toBeTruthy()
      return
    }
    expect('SUPABASE_INTEGRATION_NOT_EXECUTED').toBeTruthy()
  })
})
