import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'
import { createCrmRepository } from '../src/infrastructure/db/crm-repository.js'
import { fillMonthly } from '../src/application/crm/crm-monthly.js'
import { AppError } from '../src/http/errors/app-error.js'
import type { Db } from '../src/infrastructure/db/pool.js'
import type { CrmScope } from '../src/domain/crm-scope.js'
import type { createCrmRepository as CrmRepo } from '../src/infrastructure/db/crm-repository.js'

const USER = '22222222-2222-4222-8222-222222222222'
const OTHER = '44444444-4444-4444-8444-444444444444'
const PROSPECT = '55555555-5555-4555-8555-555555555555'
const LEAD = '66666666-6666-4666-8666-666666666666'
const ventas: CrmScope = { userId: USER, global: false }
const admin: CrmScope = { userId: OTHER, global: true }
const apps: FastifyInstance[] = []

type Row = Record<string, unknown>
type Store = { leads: Row[]; follows: Row[]; opps: Row[]; idem: Row[] }

function clone(store: Store): Store {
  return structuredClone(store)
}

function memoryDb(options: { failFollow?: boolean; failConvert?: boolean } = {}) {
  const committed: Store = { leads: [], follows: [], opps: [], idem: [] }
  let working = clone(committed)
  let open = false
  let seq = 0
  const commands: string[] = []
  const view = () => (open ? working : committed)
  const id = () => {
    seq += 1
    return `77777777-7777-4777-8777-${String(seq).padStart(12, '0')}`
  }
  const query = async (sql: string, params: unknown[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    commands.push(text)
    if (text === 'begin') {
      open = true
      working = clone(committed)
      return { rows: [] }
    }
    if (text === 'commit') {
      Object.assign(committed, clone(working))
      open = false
      return { rows: [] }
    }
    if (text === 'rollback') {
      working = clone(committed)
      open = false
      return { rows: [] }
    }
    if (text.startsWith('insert into public.crm_operation_idempotency')) {
      const key = `${params[0]}|${params[1]}|${params[2]}`
      if (!view().idem.some((row) => row.key === key)) {
        view().idem.push({ key, payload_hash: params[3], status: 'PROCESSING', response: null })
      }
      return { rows: [] }
    }
    if (text.startsWith('select payload_hash,status,response')) {
      const key = `${params[0]}|${params[1]}|${params[2]}`
      const row = view().idem.find((item) => item.key === key)
      return { rows: row ? [row] : [] }
    }
    if (text.startsWith('update public.crm_operation_idempotency')) {
      const key = `${params[0]}|${params[1]}|${params[2]}`
      const row = view().idem.find((item) => item.key === key)
      if (row) {
        row.status = 'COMPLETED'
        row.response = JSON.parse(String(params[3]))
      }
      return { rows: [] }
    }
    if (text.startsWith('select id from public.crm_prospectos') || text.startsWith('select id from public.perfiles')) {
      return { rows: [{ id: params[0] }] }
    }
    if (text.startsWith('insert into public.crm_leads')) {
      const row = {
        id: id(),
        prospecto_id: params[0],
        responsable_id: params[1],
        proxima_fecha_contacto: params[2],
        notas: params[3],
        estado: 'por_contactar',
        oportunidad_id: null,
      }
      view().leads.push(row)
      return { rows: [{ id: row.id }] }
    }
    if (text.startsWith('insert into public.crm_seguimientos_leads')) {
      if (options.failFollow) throw new Error('forced second write')
      const row = { id: id(), lead_id: params[0], nota: params[3], usuario_id: params[5] }
      view().follows.push(row)
      return { rows: [row] }
    }
    if (text.startsWith('select id,estado,prospecto_id,updated_at from public.crm_leads')) {
      const owner = text.includes('responsable_id') ? params[1] : undefined
      const row = view().leads.find((lead) => lead.id === params[0] && (owner === undefined || lead.responsable_id === owner))
      return { rows: row ? [{ id: row.id, estado: row.estado, prospecto_id: row.prospecto_id }] : [] }
    }
    if (text.startsWith("update public.crm_leads set estado='convertido'")) {
      if (options.failConvert) throw new Error('forced second write')
      const row = view().leads.find((lead) => lead.id === params[0])
      if (row) {
        row.estado = 'convertido'
        row.oportunidad_id = params[1]
      }
      return { rows: [] }
    }
    if (text.startsWith('update public.crm_leads set estado=$2')) {
      const row = view().leads.find((lead) => lead.id === params[0])
      if (row) row.estado = params[1]
      return { rows: [] }
    }
    if (text.startsWith('insert into public.crm_oportunidades')) {
      const row = { id: id(), prospecto_id: params[0], responsable_id: params[9] }
      view().opps.push(row)
      return { rows: [row] }
    }
    if (text.startsWith('insert into public.crm_seguimientos(')) {
      return { rows: [{ id: id() }] }
    }
    if (text.startsWith('select l.*')) {
      const owner = text.includes('l.responsable_id') ? params[1] : undefined
      const row = view().leads.find((lead) => lead.id === params[0] && (owner === undefined || lead.responsable_id === owner))
      return {
        rows: row
          ? [{ ...row, crm_prospectos: { id: row.prospecto_id, nombre: 'Cliente' }, perfiles: { nombre_completo: 'Resp' } }]
          : [],
      }
    }
    throw new Error(`unexpected sql: ${text}`)
  }
  const client = { query, release() {} }
  const db = { pool: { connect: async () => client }, query } as unknown as Db
  return { db, commands, committed }
}

function captureDb(rowsFor: (sql: string) => Row[] = () => []) {
  const calls: { sql: string; params: unknown[] }[] = []
  const query = async (sql: string, params: unknown[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim()
    calls.push({ sql: text, params })
    if (/count\(\*\)::text count/i.test(text)) return { rows: [{ count: '0' }] }
    return { rows: rowsFor(text) }
  }
  const client = { query, release() {} }
  return { db: { pool: { connect: async () => client }, query } as unknown as Db, calls }
}

const leadInput = {
  prospectoId: PROSPECT,
  responsableId: USER,
  proximaFechaContacto: null,
  notas: null,
}
const convertInput = {
  numeroReferencia: null,
  fechaIngreso: '2026-03-02',
  tipoServicioId: null,
  cantidadPersonal: null,
  montoEstimado: null,
  fechaEnvio: null,
  comisionMonto: null,
  comentarios: null,
  responsableId: USER,
  seguimientoInicial: false,
}

afterEach(async () => Promise.all(apps.splice(0).map((instance) => instance.close())))

describe('DIN-402 ownership SQL', () => {
  it('limits ventas opportunity reads and writes to the actor and leaves admin global', async () => {
    const captured = captureDb()
    const repo = createCrmRepository(captured.db)
    await repo.list({ page: 1, pageSize: 20, order: 'created' }, ventas)
    await expect(repo.detail(LEAD, ventas)).rejects.toBeInstanceOf(AppError)
    await expect(repo.updateOpportunity(LEAD, { updatedAt: '2026-01-01T00:00:00.000Z', comentarios: 'x' }, ventas)).rejects.toMatchObject({ statusCode: 404 })
    await expect(repo.transition(LEAD, { estado: 'aceptado', updatedAt: '2026-01-01T00:00:00.000Z' }, USER, ventas)).rejects.toMatchObject({ statusCode: 404 })
    await expect(repo.deleteOpportunity(LEAD, ventas)).rejects.toMatchObject({ statusCode: 404 })
    const scoped = captured.calls.map((call) => call.sql).join('\n')
    expect(scoped).toContain('o.responsable_id=$1')
    expect(captured.calls[0]?.params).toContain(USER)

    const global = captureDb()
    await createCrmRepository(global.db).list({ page: 1, pageSize: 20, order: 'created' }, admin)
    expect(global.calls[0]?.sql).not.toContain('responsable_id')
    await createCrmRepository(global.db).list({ page: 1, pageSize: 20, order: 'created', responsableId: USER }, admin)
    expect(global.calls.at(-1)?.sql).toContain('o.responsable_id')
  })

  it('limits ventas lead reads to the actor', async () => {
    const captured = captureDb()
    const repo = createCrmRepository(captured.db)
    await repo.listLeads({ page: 2, pageSize: 10 }, ventas)
    await expect(repo.detailLead(LEAD, ventas)).rejects.toMatchObject({ statusCode: 404 })
    expect(captured.calls[0]?.sql).toContain('l.responsable_id')
    expect(captured.calls[1]?.params).toEqual([USER, 10, 10])
    const global = captureDb()
    await createCrmRepository(global.db).listLeads({ page: 1, pageSize: 10 }, admin)
    expect(global.calls[0]?.sql).not.toContain('responsable_id')
  })
})

describe('DIN-402 lead transactions', () => {
  it('creates a lead and its initial follow-up in one transaction', async () => {
    const memory = memoryDb()
    const created = await createCrmRepository(memory.db).createLead(leadInput, ventas, 'lead-1')
    expect(created.replayed).toBe(false)
    expect(memory.committed.leads).toHaveLength(1)
    expect(memory.committed.follows.map((row) => row.nota)).toContain('Lead creado.')
    expect(memory.commands).toContain('commit')
  })

  it('rolls back lead creation when the follow-up write fails', async () => {
    const memory = memoryDb({ failFollow: true })
    await expect(createCrmRepository(memory.db).createLead(leadInput, ventas, 'lead-fail')).rejects.toThrow('forced second write')
    expect(memory.committed.leads).toHaveLength(0)
    expect(memory.committed.follows).toHaveLength(0)
    expect(memory.commands).toContain('rollback')
    expect(memory.commands).not.toContain('commit')
  })

  it('rolls back a state change when its follow-up write fails', async () => {
    const memory = memoryDb()
    const repo = createCrmRepository(memory.db)
    const created = await repo.createLead(leadInput, ventas, 'lead-state')
    const leadId = String(created.response.id)
    const failing = memoryDb({ failFollow: true })
    failing.committed.leads.push(structuredClone(memory.committed.leads[0]!))
    await expect(createCrmRepository(failing.db).transitionLead(leadId, { estado: 'en_conversacion' }, ventas)).rejects.toThrow('forced second write')
    expect(failing.committed.leads[0]?.estado).toBe('por_contactar')
    expect(failing.commands).toContain('rollback')
  })

  it('converts once, replays the same key, and rejects a second conversion', async () => {
    const memory = memoryDb()
    const repo = createCrmRepository(memory.db)
    const created = await repo.createLead(leadInput, admin, 'lead-convert')
    const leadId = String(created.response.id)
    const first = await repo.convertLead(leadId, convertInput, admin, 'convert-1')
    const replay = await repo.convertLead(leadId, convertInput, admin, 'convert-1')
    expect(first.replayed).toBe(false)
    expect(replay.replayed).toBe(true)
    expect(replay.response.opportunity.id).toBe(first.response.opportunity.id)
    expect(memory.committed.opps).toHaveLength(1)
    expect(memory.committed.leads[0]).toMatchObject({ estado: 'convertido', oportunidad_id: first.response.opportunity.id })
    await expect(repo.convertLead(leadId, convertInput, admin, 'convert-2')).rejects.toMatchObject({ statusCode: 409 })
    expect(memory.committed.opps).toHaveLength(1)
  })

  it('rolls back conversion when linking the lead fails', async () => {
    const memory = memoryDb({ failConvert: true })
    const repo = createCrmRepository(memory.db)
    const created = await repo.createLead(leadInput, ventas, 'lead-rollback')
    await expect(repo.convertLead(String(created.response.id), convertInput, ventas, 'convert-fail')).rejects.toThrow('forced second write')
    expect(memory.committed.opps).toHaveLength(0)
    expect(memory.committed.leads[0]?.estado).toBe('por_contactar')
    expect(memory.commands).toContain('rollback')
  })

  it('replays an opportunity create with the same key and does not insert twice', async () => {
    const memory = memoryDb()
    const repo = createCrmRepository(memory.db)
    const body = { ...convertInput, prospectoId: PROSPECT, seguimientoInicial: false }
    const first = await repo.createOpportunity(body, USER, 'opp-1')
    const second = await repo.createOpportunity(body, USER, 'opp-1')
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.response.id).toBe(first.response.id)
    expect(memory.committed.opps).toHaveLength(1)
  })

  it('denies conversion of another salesperson lead', async () => {
    const memory = memoryDb()
    const repo = createCrmRepository(memory.db)
    const created = await repo.createLead(leadInput, ventas, 'lead-foreign')
    await expect(
      repo.convertLead(String(created.response.id), { ...convertInput, responsableId: OTHER }, { userId: OTHER, global: false }, 'convert-foreign'),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(memory.committed.opps).toHaveLength(0)
    expect(memory.committed.leads[0]?.estado).toBe('por_contactar')
  })
})

describe('DIN-402 agenda and monthly summary', () => {
  it('keeps active opportunities and open leads, and pages the union', async () => {
    const captured = captureDb()
    await createCrmRepository(captured.db).agenda({ page: 1, pageSize: 25 }, ventas)
    const sql = captured.calls.map((call) => call.sql).join('\n')
    expect(sql).toContain("o.estado='en_seguimiento'")
    expect(sql).toContain("l.estado in ('por_contactar','en_conversacion')")
    expect(sql).not.toContain('sin_interes')
    expect(sql).not.toContain('convertido')
    expect(sql).toContain('order by fecha asc nulls last')
    expect(sql).toContain('limit')
    expect(captured.calls[0]?.params).toContain(USER)
    const leadsOnly = captureDb()
    await createCrmRepository(leadsOnly.db).agenda({ page: 1, pageSize: 25, tipo: 'lead' }, admin)
    expect(leadsOnly.calls[0]?.sql).not.toContain('crm_oportunidades')
  })

  it('counts created opportunities by ingreso and accepted ones by cierre', async () => {
    const captured = captureDb((sql) =>
      sql.includes('fecha_cierre')
        ? [{ mes: '2026-03', categoria: 'Limpieza', cantidad: '1' }]
        : [{ mes: '2026-01', categoria: 'Limpieza', cantidad: '1' }],
    )
    const rows = await createCrmRepository(captured.db).monthly(
      { dimension: 'tipo_servicio' },
      ventas,
      { desde: '2026-01-01', hasta: '2026-03-31' },
    )
    const filled = fillMonthly('2026-01-01', '2026-03-31', rows.creadas, rows.aceptadas)
    expect(captured.calls[0]?.sql).toContain('o.fecha_ingreso')
    expect(captured.calls[1]?.sql).toContain("o.estado='aceptado'")
    expect(captured.calls[1]?.sql).toContain('o.fecha_cierre')
    expect(captured.calls[0]?.params).toContain(USER)
    expect(filled.creadas.find((point) => point.mes === '2026-01')?.total).toBe(1)
    expect(filled.creadas.find((point) => point.mes === '2026-03')?.total).toBe(0)
    expect(filled.aceptadas.find((point) => point.mes === '2026-01')?.total).toBe(0)
    expect(filled.aceptadas.find((point) => point.mes === '2026-03')?.total).toBe(1)
    expect(filled.creadas.find((point) => point.mes === '2026-02')?.total).toBe(0)

    const byOwner = captureDb()
    await createCrmRepository(byOwner.db).monthly({ dimension: 'responsable' }, admin, { desde: '2026-01-01', hasta: '2026-03-31' })
    expect(byOwner.calls[0]?.sql).toContain('pr.nombre_completo')
    expect(byOwner.calls[0]?.sql).not.toContain('responsable_id=$')
  })
})

describe('DIN-402 HTTP scope', () => {
  function repo() {
    const calls: unknown[][] = []
    return {
      calls,
      value: {
        list: vi.fn(async (...args: unknown[]) => {
          calls.push(args)
          return { items: [], page: 1, pageSize: 50, total: 0 }
        }),
        dashboard: vi.fn(async () => ({ items: [], page: 1, pageSize: 50, total: 0, seguimientos: [], vistas: [], novedades: [] })),
        summary: vi.fn(async () => ({ totalCantidad: 0, totalMonto: 0, porEstado: [], porTipoCliente: [], porReferidor: [], montoAceptado: 0, tasaConversion: null, comisionTotal: 0, comisionLiquidada: 0, comisionPendiente: 0 })),
        monthly: vi.fn(async () => ({ creadas: [], aceptadas: [] })),
        agenda: vi.fn(async () => ({ items: [], page: 1, pageSize: 50, total: 0 })),
        detail: vi.fn(async () => ({ id: LEAD })),
        catalogs: vi.fn(async () => ({ prospectos: [], tiposServicio: [], tiposCliente: [], referidores: [], responsables: [] })),
        followUps: vi.fn(async () => ({ items: [], page: 1, pageSize: 50, total: 0 })),
        createProspect: vi.fn(async () => ({ id: PROSPECT, nombre: 'Prospecto' })),
        updateProspect: vi.fn(async () => ({ id: PROSPECT, nombre: 'Prospecto' })),
        createOpportunity: vi.fn(async (body: { responsableId: string }) => ({ replayed: false, response: { id: LEAD, responsable_id: body.responsableId } })),
        updateOpportunity: vi.fn(async () => ({ id: LEAD })),
        transition: vi.fn(async () => ({ id: LEAD })),
        createFollowUp: vi.fn(async () => ({ id: LEAD })),
        deleteOpportunity: vi.fn(async () => undefined),
        markViewed: vi.fn(async () => ({ id: LEAD })),
        listLeads: vi.fn(async () => ({ items: [], page: 1, pageSize: 50, total: 0 })),
        detailLead: vi.fn(async () => ({ id: LEAD })),
        createLead: vi.fn(async (body: { responsableId: string }) => ({ replayed: false, response: { id: LEAD, responsable_id: body.responsableId } })),
        updateLead: vi.fn(async () => ({ id: LEAD })),
        transitionLead: vi.fn(async () => ({ id: LEAD })),
        followUpsLead: vi.fn(async () => ({ items: [], page: 1, pageSize: 50, total: 0 })),
        createLeadFollowUp: vi.fn(async () => ({ id: LEAD })),
        deleteLead: vi.fn(async () => undefined),
        convertLead: vi.fn(async (_id: string, body: { responsableId: string }) => ({ replayed: false, response: { lead: { id: LEAD }, opportunity: { id: LEAD, responsable_id: body.responsableId } } })),
        catalog: vi.fn(() => ({ list: vi.fn(async () => []), create: vi.fn(), status: vi.fn() })),
      } as unknown as ReturnType<typeof CrmRepo>,
    }
  }

  async function app(role: string, crmRepo: ReturnType<typeof CrmRepo>) {
    const instance = await buildApp(testEnv(), { db: createProfileStubDb({ profile: { id: USER, nombre_completo: 'User', rol: role } }), crmRepo })
    apps.push(instance)
    await instance.ready()
    return instance
  }

  it('forces ventas ownership on create and keeps admin and gerente assignment', async () => {
    for (const role of ['admin', 'gerente'] as const) {
      const doubled = repo()
      const instance = await app(role, doubled.value)
      const headers = { authorization: `Bearer ${await signAccessToken({ sub: USER })}`, 'idempotency-key': `${role}-opp` }
      const response = await instance.inject({ method: 'POST', url: '/v1/crm/opportunities', headers, payload: { prospectoId: PROSPECT, responsableId: OTHER, fechaIngreso: '2026-01-15' } })
      expect(response.statusCode).toBe(201)
      expect(doubled.value.createOpportunity).toHaveBeenCalledWith(expect.objectContaining({ responsableId: OTHER }), USER, `${role}-opp`)
      const listed = await instance.inject({ method: 'GET', url: '/v1/crm/opportunities', headers })
      expect(listed.statusCode).toBe(200)
      expect(doubled.calls[0]?.[1]).toMatchObject({ global: true, userId: USER })
    }

    const own = repo()
    const instance = await app('ventas', own.value)
    const headers = { authorization: `Bearer ${await signAccessToken({ sub: USER })}`, 'idempotency-key': 'ventas-lead' }
    const created = await instance.inject({ method: 'POST', url: '/v1/crm/leads', headers, payload: { prospectoId: PROSPECT, responsableId: OTHER } })
    expect(created.statusCode).toBe(201)
    expect(own.value.createLead).toHaveBeenCalledWith(expect.objectContaining({ responsableId: USER }), expect.objectContaining({ global: false, userId: USER }), 'ventas-lead')
    expect((await instance.inject({ method: 'DELETE', url: `/v1/crm/leads/${LEAD}`, headers })).statusCode).toBe(403)
    expect(own.value.deleteLead).not.toHaveBeenCalled()
    expect((await instance.inject({ method: 'DELETE', url: `/v1/crm/opportunities/${LEAD}`, headers })).statusCode).toBe(403)
  })

  it('still lets a role with crm:delete remove a lead', async () => {
    const doubled = repo()
    const instance = await app('gerente', doubled.value)
    const headers = { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
    expect((await instance.inject({ method: 'DELETE', url: `/v1/crm/leads/${LEAD}`, headers })).statusCode).toBe(204)
    expect(doubled.value.deleteLead).toHaveBeenCalledWith(LEAD, { userId: USER, global: true })
  })
})
