/**
 * DIN-402 CRM against the authorized test database.
 *
 *   RUN_SUPABASE_INTEGRATION=1 NODE_ENV=test
 *   EXPECTED_SUPABASE_TEST_PROJECT_REF (or EXPECTED_SUPABASE_PROJECT_REF when DB_COMPATIBILITY_TARGET=test)
 *   SUPABASE_URL DATABASE_URL
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../src/infrastructure/db/pool.js'
import { createCrmRepository } from '../src/infrastructure/db/crm-repository.js'
import type { CrmScope } from '../src/domain/crm-scope.js'
import { testEnv } from './helpers.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'
const marker = `DIN402-${Date.now()}`

function migrationPool() {
  const url = process.env.MIGRATIONS_DATABASE_URL
  if (!url) throw new Error('MIGRATIONS_DATABASE_URL is required to install the rollback fixture')
  return new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    ssl: /supabase\.co|pooler\.supabase/i.test(url) ? { rejectUnauthorized: false } : undefined,
  })
}

describe.skipIf(!enabled)('DIN-402 CRM PostgreSQL integration', () => {
  let db: Db
  let repo: ReturnType<typeof createCrmRepository>
  let actor: string
  let other: string
  const prospectIds: string[] = []
  const keys: string[] = []

  beforeAll(async () => {
    const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    config({ path: path.join(apiRoot, '.env') })
    config({ path: path.join(apiRoot, '.env.local') })
    if (!process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF && process.env.DB_COMPATIBILITY_TARGET === 'test') {
      process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF = process.env.EXPECTED_SUPABASE_PROJECT_REF
    }
    assertDinamicCleanTestTarget()
    db = createDb(testEnv({ DATABASE_URL: process.env.DATABASE_URL! }))
    repo = createCrmRepository(db)
    const perfiles = await db.query<{ id: string }>('select id from public.perfiles order by id limit 2')
    actor = String(perfiles.rows[0]?.id)
    other = String(perfiles.rows[1]?.id)
    expect(actor).toMatch(/^[0-9a-f-]{36}$/i)
    expect(other).toMatch(/^[0-9a-f-]{36}$/i)
    expect(actor).not.toBe(other)
    await db.query(`delete from public.crm_seguimientos where oportunidad_id in (
select o.id from public.crm_oportunidades o join public.crm_prospectos p on p.id=o.prospecto_id where p.nombre like 'DIN402-%')`)
    await db.query(`delete from public.crm_leads where prospecto_id in (select id from public.crm_prospectos where nombre like 'DIN402-%')`)
    await db.query(`delete from public.crm_oportunidades where prospecto_id in (select id from public.crm_prospectos where nombre like 'DIN402-%')`)
    await db.query(`delete from public.crm_prospectos where nombre like 'DIN402-%'`)
    await db.query(`delete from public.crm_operation_idempotency where idempotency_key like 'DIN402-%'`)
  }, 30_000)

  afterAll(async () => {
    if (!db) return
    const owner = migrationPool()
    try {
      await owner.query('alter table public.crm_seguimientos_leads drop constraint if exists din402_test_block_follow_up')
      await db.query(`delete from public.crm_seguimientos where oportunidad_id in (
select o.id from public.crm_oportunidades o join public.crm_prospectos p on p.id=o.prospecto_id where p.nombre like 'DIN402-%')`)
      await db.query(`delete from public.crm_leads where prospecto_id in (select id from public.crm_prospectos where nombre like 'DIN402-%')`)
      await db.query(`delete from public.crm_oportunidades where prospecto_id in (select id from public.crm_prospectos where nombre like 'DIN402-%')`)
      await db.query(`delete from public.crm_prospectos where nombre like 'DIN402-%'`)
      await db.query(`delete from public.crm_operation_idempotency where idempotency_key like 'DIN402-%'`)
    } finally {
      await owner.end()
      await db.close()
    }
  }, 30_000)

  const scope = (userId: string, global = false): CrmScope => ({ userId, global })
  const leadBody = (prospectoId: string, responsableId: string) => ({
    prospectoId,
    responsableId,
    proximaFechaContacto: null,
    notas: marker,
  })

  async function prospect() {
    const created = await repo.createProspect({
      nombre: marker,
      tipoClienteId: null,
      contactoNombre: null,
      telefono: 'original',
      email: null,
      referidoPorId: null,
      notas: null,
    })
    prospectIds.push(String(created.id))
    return String(created.id)
  }

  it('checks leads schema, triggers, constraints and dinamic_api grants', async () => {
    const tables = await db.query<{ relname: string; rls: boolean }>(
      `select c.relname, c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('crm_leads','crm_seguimientos_leads') order by 1`,
    )
    expect(tables.rows).toEqual([
      { relname: 'crm_leads', rls: true },
      { relname: 'crm_seguimientos_leads', rls: true },
    ])
    const triggers = await db.query<{ tgname: string }>(
      `select tgname from pg_trigger where tgrelid in ('public.crm_leads'::regclass,'public.crm_seguimientos_leads'::regclass) and not tgisinternal order by 1`,
    )
    expect(triggers.rows.map((row) => row.tgname)).toEqual([
      'trg_crm_leads_fecha_conversion',
      'trg_crm_leads_updated_at',
      'trg_crm_seguimientos_leads_proxima_fecha',
    ])
    const fk = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) def from pg_constraint where conname='crm_leads_oportunidad_id_fkey'`,
    )
    expect(fk.rows[0]?.def).toContain('ON DELETE SET NULL')
    expect(await db.query(`select has_table_privilege('dinamic_api','public.crm_leads','INSERT') allowed`)).toMatchObject({
      rows: [{ allowed: true }],
    })
    expect(await db.query(`select has_table_privilege('authenticated','public.crm_leads','UPDATE') allowed`)).toMatchObject({
      rows: [{ allowed: false }],
    })
  })

  it('rolls back lead creation and conversion when the follow-up write fails', async () => {
    const prospectoId = await prospect()
    const block = async (note: 'Lead creado.' | 'Lead convertido a oportunidad.', run: () => Promise<void>) => {
      const name = 'din402_test_block_follow_up'
      const literal = note === 'Lead creado.' ? 'Lead creado.' : 'Lead convertido a oportunidad.'
      const owner = migrationPool()
      try {
        await owner.query(`alter table public.crm_seguimientos_leads drop constraint if exists ${name}`)
        await owner.query(
          `alter table public.crm_seguimientos_leads add constraint ${name} check (nota is distinct from '${literal}') not valid`,
        )
        await run()
      } finally {
        await owner.query(`alter table public.crm_seguimientos_leads drop constraint if exists ${name}`)
        await owner.end()
      }
    }
    const createKey = `${marker}-rollback`
    keys.push(createKey)
    await block('Lead creado.', async () => {
      await expect(repo.createLead(leadBody(prospectoId, actor), scope(actor, true), createKey)).rejects.toBeTruthy()
    })
    expect(Number((await db.query('select count(*)::text count from public.crm_leads where prospecto_id=$1', [prospectoId])).rows[0].count)).toBe(0)

    const keptKey = `${marker}-kept`
    keys.push(keptKey)
    const created = await repo.createLead(leadBody(prospectoId, actor), scope(actor, true), keptKey)
    const convertKey = `${marker}-convert-rollback`
    keys.push(convertKey)
    await block('Lead convertido a oportunidad.', async () => {
      await expect(
        repo.convertLead(
          String(created.response.id),
          {
            numeroReferencia: null,
            tipoServicioId: null,
            cantidadPersonal: null,
            montoEstimado: null,
            fechaEnvio: null,
            comisionMonto: null,
            comentarios: marker,
            responsableId: actor,
            seguimientoInicial: false,
          },
          scope(actor, true),
          convertKey,
        ),
      ).rejects.toBeTruthy()
    })
    expect((await db.query('select estado from public.crm_leads where id=$1', [created.response.id])).rows[0].estado).toBe('por_contactar')
    expect(Number((await db.query('select count(*)::text count from public.crm_oportunidades where prospecto_id=$1', [prospectoId])).rows[0].count)).toBe(0)
  }, 30_000)

  it('keeps one lead for two concurrent creates with the same key', async () => {
    const prospectoId = await prospect()
    const key = `${marker}-idem`
    keys.push(key)
    const body = leadBody(prospectoId, actor)
    const [a, b] = await Promise.all([
      repo.createLead(body, scope(actor, true), key),
      repo.createLead(body, scope(actor, true), key),
    ])
    expect([a.replayed, b.replayed].sort()).toEqual([false, true])
    expect(Number((await db.query('select count(*)::text count from public.crm_leads where prospecto_id=$1', [prospectoId])).rows[0].count)).toBe(1)
    expect(Number((await db.query('select count(*)::text count from public.crm_seguimientos_leads where lead_id=$1', [a.response.id])).rows[0].count)).toBe(1)
  })

  it('converts a lead once when two different keys race', async () => {
    const prospectoId = await prospect()
    const key = `${marker}-lead`
    keys.push(key)
    const created = await repo.createLead(leadBody(prospectoId, actor), scope(actor, true), key)
    const convert = {
      numeroReferencia: null,
      tipoServicioId: null,
      cantidadPersonal: null,
      montoEstimado: null,
      fechaEnvio: null,
      comisionMonto: null,
      comentarios: marker,
      responsableId: actor,
      seguimientoInicial: false,
    }
    const keysConvert = [`${marker}-c1`, `${marker}-c2`]
    keys.push(...keysConvert)
    const results = await Promise.all(
      keysConvert.map((convertKey) =>
        repo.convertLead(String(created.response.id), convert, scope(actor, true), convertKey).then(
          (value) => ({ ok: true as const, value }),
          (error: { statusCode?: number }) => ({ ok: false as const, statusCode: error.statusCode }),
        ),
      ),
    )
    const won = results.find((result) => result.ok)
    const lost = results.find((result) => !result.ok)
    expect(won?.ok).toBe(true)
    expect(lost).toMatchObject({ ok: false, statusCode: 409 })
    const rows = await db.query<{ estado: string; oportunidad_id: string | null }>(
      'select estado, oportunidad_id from public.crm_leads where id=$1',
      [created.response.id],
    )
    expect(rows.rows[0]?.estado).toBe('convertido')
    expect(rows.rows[0]?.oportunidad_id).toBeTruthy()
    expect(Number((await db.query('select count(*)::text count from public.crm_oportunidades where prospecto_id=$1', [prospectoId])).rows[0].count)).toBe(1)
  })

  it('denies a shared prospect mutation and rejects a stale lead update', async () => {
    const prospectoId = await prospect()
    const ownKey = `${marker}-own`
    const foreignKey = `${marker}-foreign`
    keys.push(ownKey, foreignKey)
    const own = await repo.createLead(leadBody(prospectoId, actor), scope(actor, true), ownKey)
    const foreign = await repo.createLead(leadBody(prospectoId, other), scope(other, true), foreignKey)
    expect(String(foreign.response.id)).not.toBe(String(own.response.id))
    await expect(
      repo.updateProspect(prospectoId, { telefono: 'cambiado' }, scope(actor, false)),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect((await db.query('select telefono from public.crm_prospectos where id=$1', [prospectoId])).rows[0].telefono).toBe('original')
    await repo.updateProspect(prospectoId, { telefono: 'admin' }, scope(actor, true))
    expect((await db.query('select telefono from public.crm_prospectos where id=$1', [prospectoId])).rows[0].telefono).toBe('admin')

    const version = String((own.response as { updated_at: string | Date }).updated_at instanceof Date
      ? (own.response as { updated_at: Date }).updated_at.toISOString()
      : (own.response as { updated_at: string }).updated_at)
    await repo.updateLead(String(own.response.id), { updatedAt: version, notas: 'primera' }, scope(actor, true))
    await expect(
      repo.updateLead(String(own.response.id), { updatedAt: version, notas: 'stale', prospecto: { telefono: 'no' } }, scope(actor, true)),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect((await db.query('select notas from public.crm_leads where id=$1', [own.response.id])).rows[0].notas).toBe('primera')
    expect((await db.query('select telefono from public.crm_prospectos where id=$1', [prospectoId])).rows[0].telefono).toBe('admin')
  })

  it('lists, follows up, changes state and shows the open lead on the agenda', async () => {
    const prospectoId = await prospect()
    const key = `${marker}-flow`
    keys.push(key)
    const created = await repo.createLead({ ...leadBody(prospectoId, actor), proximaFechaContacto: '1990-01-01' }, scope(actor, true), key)
    const leadId = String(created.response.id)
    const listed = await repo.listLeads({ page: 1, pageSize: 50, search: marker }, scope(actor, false))
    expect(listed.items.some((item) => item.id === leadId)).toBe(true)
    await repo.createLeadFollowUp(leadId, { nota: `${marker} contacto`, proximaFechaContacto: '2026-03-02' }, scope(actor, false))
    await repo.transitionLead(leadId, { estado: 'en_conversacion' }, scope(actor, false))
    let onAgenda = false
    for (let page = 1; page <= 20 && !onAgenda; page += 1) {
      const agenda = await repo.agenda({ page, pageSize: 100, tipo: 'lead' }, scope(actor, false))
      onAgenda = agenda.items.some((item) => item.id === leadId && item.tipo === 'lead')
      if (agenda.items.length < 100) break
    }
    expect(onAgenda).toBe(true)
    const detail = await repo.detailLead(leadId, scope(actor, false))
    expect(detail.estado).toBe('en_conversacion')
    expect(detail.oportunidad_id).toBeNull()
  })
})
