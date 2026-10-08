/**
 * Real Supabase Auth + API + DB smoke for rol `ventas` (opt-in).
 *
 * Required env (test target only):
 *   RUN_VENTAS_SMOKE=1
 *   RUN_SUPABASE_INTEGRATION=1
 *   NODE_ENV=test
 *   EXPECTED_SUPABASE_TEST_PROJECT_REF=<ref>
 *   SUPABASE_URL, SUPABASE_ANON_KEY (or NEXT_PUBLIC_*), SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL
 *   Optional SMOKE_TEST_ADMIN_EMAIL + SMOKE_TEST_ADMIN_PASSWORD (AAL2) → POST /v1/users
 *   If omitted, provisions ventas via createUser() (same service as POST /v1/users, Auth Admin API)
 *
 *   npx vitest run tests/ventas-role-smoke.integration.test.ts
 */
import { createClient } from '@supabase/supabase-js'
import { decodeJwt } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createUser } from '../src/application/users/users-service.js'
import { buildApp } from '../src/app.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const enabled =
  process.env.RUN_VENTAS_SMOKE === '1' && process.env.RUN_SUPABASE_INTEGRATION === '1'

function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL is required')
  return url.replace(/\/$/, '')
}

function anonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) throw new Error('SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is required')
  return key
}

async function signInAccessToken(email: string, password: string): Promise<string> {
  const client = createClient(supabaseUrl(), anonKey(), { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token) {
    throw error ?? new Error(`signInWithPassword failed for ${email}`)
  }
  return data.session.access_token
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe.skipIf(!enabled)('ventas role smoke (Supabase Auth + API + DB)', () => {
  let app: FastifyInstance
  let ventasAuthId: string
  let ventasToken: string
  const ventasEmail = `ventas-smoke-${Date.now()}@dinamic-clean.test`
  const ventasPassword = `Smoke-${Date.now()}-Aa1!`
  let createdProspectId: string | undefined

  beforeAll(async () => {
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const { config } = await import('dotenv')
    const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    config({ path: path.join(apiRoot, '.env') })
    config({ path: path.join(apiRoot, '.env.local') })
    config({ path: path.join(apiRoot, '../../.env.local') })
    if (!process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF && process.env.DB_COMPATIBILITY_TARGET === 'test') {
      process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF = process.env.EXPECTED_SUPABASE_PROJECT_REF
    }

    assertDinamicCleanTestTarget({ requireJwt: false })
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY required for smoke cleanup')
    }
    const { loadEnv } = await import('../src/config/env.js')
    app = await buildApp(loadEnv())
    await app.ready()

    const usersDeps = {
      identity: app.identityAdmin,
      profiles: app.profilesRepo,
    }
    const adminEmail = process.env.SMOKE_TEST_ADMIN_EMAIL?.trim()
    const adminPassword = process.env.SMOKE_TEST_ADMIN_PASSWORD

    if (adminEmail && adminPassword) {
      const adminToken = await signInAccessToken(adminEmail, adminPassword)
      const adminAal = decodeJwt(adminToken).aal
      if (adminAal !== 'aal2') {
        throw new Error(
          `Admin session must be AAL2 for POST /v1/users (got aal=${String(adminAal)}). Complete MFA for the smoke admin.`,
        )
      }
      const created = await app.inject({
        method: 'POST',
        url: '/v1/users',
        headers: authHeaders(adminToken),
        payload: {
          email: ventasEmail,
          password: ventasPassword,
          nombreCompleto: 'Ventas Smoke Test',
          rol: 'ventas',
        },
      })
      expect(created.statusCode, created.body).toBe(201)
      ventasAuthId = (created.json() as { id: string }).id
    } else {
      const created = await createUser(
        usersDeps,
        {
          email: ventasEmail,
          password: ventasPassword,
          nombreCompleto: 'Ventas Smoke Test',
          rol: 'ventas',
        },
        { requestId: 'ventas-smoke-setup' },
      )
      ventasAuthId = created.id
    }

    ventasToken = await signInAccessToken(ventasEmail, ventasPassword)
  }, 60_000)

  afterAll(async () => {
    if (!enabled || !ventasAuthId) {
      await app?.close()
      return
    }
    if (createdProspectId && app) {
      await app.db.query(
        `delete from public.crm_seguimientos where oportunidad_id in (
select id from public.crm_oportunidades where prospecto_id=$1)`,
        [createdProspectId],
      )
      await app.db.query('delete from public.crm_leads where prospecto_id=$1', [createdProspectId])
      await app.db.query('delete from public.crm_oportunidades where prospecto_id=$1', [createdProspectId])
      await app.db.query('delete from public.crm_prospectos where id=$1', [createdProspectId])
      await app.db.query('delete from public.crm_operation_idempotency where actor_id=$1', [ventasAuthId])
    }
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(supabaseUrl(), service, { auth: { persistSession: false } })
    await admin.auth.admin.deleteUser(ventasAuthId)
    await app?.close()
  }, 30_000)

  it('GET /v1/me → 200 role ventas', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: authHeaders(ventasToken) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ role: 'ventas' })
  })

  it('authenticates a ventas user through the lead flow and keeps prospect ownership', async () => {
    const headers = authHeaders(ventasToken)
    expect((await app.inject({ method: 'GET', url: '/v1/crm/opportunities', headers })).statusCode).toBe(200)

    const nombre = `Smoke lead ${Date.now()}`
    const prospect = await app.inject({
      method: 'POST',
      url: '/v1/crm/prospects',
      headers,
      payload: { nombre },
    })
    expect(prospect.statusCode, prospect.body).toBe(201)
    createdProspectId = (prospect.json() as { id: string }).id

    const unowned = await app.inject({
      method: 'PATCH',
      url: `/v1/crm/prospects/${createdProspectId}`,
      headers,
      payload: { telefono: 'no' },
    })
    expect(unowned.statusCode, unowned.body).toBe(403)

    const created = await app.inject({
      method: 'POST',
      url: '/v1/crm/leads',
      headers: { ...headers, 'idempotency-key': `smoke-lead-${Date.now()}` },
      payload: { prospectoId: createdProspectId, responsableId: ventasAuthId, notas: 'smoke' },
    })
    expect(created.statusCode, created.body).toBe(201)
    const leadId = (created.json() as { response: { id: string } }).response.id

    const ficha = await app.inject({ method: 'GET', url: `/v1/crm/leads/${leadId}`, headers })
    expect(ficha.statusCode, ficha.body).toBe(200)

    const follow = await app.inject({
      method: 'POST',
      url: `/v1/crm/leads/${leadId}/follow-ups`,
      headers,
      payload: { nota: 'contacto smoke', proximaFechaContacto: '1990-01-01' },
    })
    expect(follow.statusCode, follow.body).toBe(200)

    const state = await app.inject({
      method: 'PATCH',
      url: `/v1/crm/leads/${leadId}/state`,
      headers,
      payload: { estado: 'en_conversacion' },
    })
    expect(state.statusCode, state.body).toBe(200)

    const current = await app.inject({ method: 'GET', url: `/v1/crm/leads/${leadId}`, headers })
    expect(current.statusCode, current.body).toBe(200)
    const version = (current.json() as { updated_at: string }).updated_at
    expect(version).toBeTruthy()

    const edited = await app.inject({
      method: 'PATCH',
      url: `/v1/crm/leads/${leadId}`,
      headers,
      payload: { updatedAt: version, notas: 'editado', prospecto: { telefono: '111' } },
    })
    expect(edited.statusCode, edited.body).toBe(200)

    const agenda = await app.inject({
      method: 'GET',
      url: '/v1/crm/agenda?tipo=lead&page=1&pageSize=100',
      headers,
    })
    expect(agenda.statusCode, agenda.body).toBe(200)
    expect((agenda.json() as { items: { id: string }[] }).items.some((item) => item.id === leadId)).toBe(true)

    const listed = await app.inject({
      method: 'GET',
      url: `/v1/crm/leads?search=${encodeURIComponent(nombre)}&page=1&pageSize=50`,
      headers,
    })
    expect(listed.statusCode, listed.body).toBe(200)
    expect((listed.json() as { items: { id: string }[] }).items.some((item) => item.id === leadId)).toBe(true)

    const converted = await app.inject({
      method: 'POST',
      url: `/v1/crm/leads/${leadId}/convert`,
      headers: { ...headers, 'idempotency-key': `smoke-convert-${Date.now()}` },
      payload: { responsableId: ventasAuthId, seguimientoInicial: false, comentarios: 'smoke' },
    })
    expect(converted.statusCode, converted.body).toBe(201)
    const opportunityId = (converted.json() as { response: { opportunity: { id: string } } }).response.opportunity.id

    const linked = await app.inject({ method: 'GET', url: `/v1/crm/leads/${leadId}`, headers })
    expect(linked.statusCode, linked.body).toBe(200)
    expect(linked.json()).toMatchObject({ estado: 'convertido', oportunidad_id: opportunityId })

    expect(
      (await app.inject({
        method: 'DELETE',
        url: '/v1/crm/opportunities/00000000-0000-4000-8000-000000000001',
        headers,
      })).statusCode,
    ).toBe(403)
  }, 30_000)

  it('denies non-CRM domains with 403', async () => {
    const headers = authHeaders(ventasToken)
    for (const [method, url] of [
      ['GET', '/v1/results'],
      ['GET', '/v1/clients'],
      ['GET', '/v1/audits'],
      ['GET', '/v1/users'],
      ['GET', '/v1/purchase-requests'],
    ] as const) {
      expect((await app.inject({ method, url, headers })).statusCode).toBe(403)
    }
  })
})
