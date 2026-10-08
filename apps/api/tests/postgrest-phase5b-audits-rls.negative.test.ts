import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createAuditsRepository } from '../src/infrastructure/db/audits-repository.js'
import { testEnv } from './helpers.js'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const ready = Boolean(process.env.RUN_SUPABASE_INTEGRATION === '1' && url && anon && service && process.env.DATABASE_URL)
const nil = '00000000-0000-0000-0000-000000000000'

describe.skipIf(!ready)('Phase 5B Audits PostgREST negative', () => {
  const users: Array<{ id: string; token: string }> = []
  const password = `P5b-${crypto.randomUUID()}!Aa1`
  let aliasId = ''
  let supervisorId = ''

  beforeAll(async () => {
    const admin = createClient(url!, service!, { auth: { persistSession: false } })
    const email = `phase5b-audits-${crypto.randomUUID()}@example.invalid`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error || !created.data.user) throw created.error ?? new Error('Auth user not created')
    const profile = await admin.from('perfiles').upsert({
      id: created.data.user.id,
      nombre_completo: 'Phase 5B Audits',
      rol: 'admin',
    })
    if (profile.error) throw profile.error
    const browser = createClient(url!, anon!, { auth: { persistSession: false } })
    const signed = await browser.auth.signInWithPassword({ email, password })
    if (signed.error || !signed.data.session) throw signed.error ?? new Error('Session not created')
    users.push({ id: created.data.user.id, token: signed.data.session.access_token })

    const db = createDb(testEnv({ DATABASE_URL: process.env.DATABASE_URL! }))
    try {
      const refs = (
        await db.query(
          `select
             (select id from public.cliente_domicilios order by id limit 1) as alias_id,
             (select id from public.perfiles order by id limit 1) as supervisor_id`,
        )
      ).rows[0]
      aliasId = String(refs.alias_id)
      supervisorId = String(refs.supervisor_id)
    } finally {
      await db.close()
    }
  }, 60_000)

  afterAll(async () => {
    if (!ready) return
    const admin = createClient(url!, service!, { auth: { persistSession: false } })
    for (const user of users) await admin.auth.admin.deleteUser(user.id)
  }, 30_000)

  const mutations = [
    ['POST', 'auditoria_planificaciones', { alias_id: nil, fecha_propuesta: '2026-10-01', supervisor_id: nil }],
    ['PATCH', `auditoria_planificaciones?id=eq.${nil}`, { observaciones: 'x' }],
    ['POST', 'auditorias', { alias_id: nil, plantilla_id: nil, fecha_realizada: '2026-10-01', supervisor_id: nil }],
    ['POST', 'auditoria_respuestas', { auditoria_id: nil, item_id: nil, resultado: 'conforme' }],
    ['POST', 'auditoria_plan_accion', { auditoria_id: nil, descripcion: 'x' }],
    ['PATCH', `auditoria_plan_accion?id=eq.${nil}`, { estado: 'en_curso' }],
    ['POST', 'auditoria_checklist_plantillas', { codigo_formulario: 'X', version: '1', vigencia_desde: '2026-01-01' }],
    ['PATCH', `auditoria_checklist_plantillas?id=eq.${nil}`, { activa: true }],
    ['POST', 'auditoria_checklist_items', { plantilla_id: nil, orden: 1, texto: 'x' }],
    ['PATCH', `auditoria_checklist_items?id=eq.${nil}`, { texto: 'y' }],
    ['DELETE', `auditoria_checklist_items?id=eq.${nil}`, null],
  ] as const

  it('denies anon and authenticated browser DML while SELECT remains allowed', async () => {
    const user = users[0]!
    for (const [method, resource, payload] of mutations) {
      const anonResponse = await fetch(`${url}/rest/v1/${resource}`, {
        method,
        headers: {
          apikey: anon!,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      })
      expect(anonResponse.ok, `anon ${method} ${resource}`).toBe(false)
      expect([401, 403]).toContain(anonResponse.status)

      const authResponse = await fetch(`${url}/rest/v1/${resource}`, {
        method,
        headers: {
          apikey: anon!,
          authorization: `Bearer ${user.token}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      })
      expect(authResponse.ok, `auth ${method} ${resource}`).toBe(false)
      expect([401, 403]).toContain(authResponse.status)
    }

    for (const table of [
      'auditorias',
      'auditoria_planificaciones',
      'auditoria_respuestas',
      'auditoria_checklist_plantillas',
      'auditoria_checklist_items',
      'auditoria_plan_accion',
    ]) {
      const select = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey: anon!, authorization: `Bearer ${user.token}` },
      })
      expect(select.ok, `auth SELECT ${table}`).toBe(true)
    }
  }, 60_000)

  it('allows the same planning write through dinamic_api repository', async () => {
    const db = createDb(testEnv({ DATABASE_URL: process.env.DATABASE_URL! }))
    const repo = createAuditsRepository(db)
    try {
      const created = (await repo.createPlanning({
        aliasId,
        fechaPropuesta: '2099-02-02',
        horarioDesde: null,
        horarioHasta: null,
        supervisorId,
        observaciones: 'phase5b-postgrest-allow',
      })) as { id: string }
      await db.query('delete from public.auditoria_planificaciones where id = $1', [created.id])
    } finally {
      await db.close()
    }
  }, 30_000)
})
