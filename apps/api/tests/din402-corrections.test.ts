import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createCrmRepository } from '../src/infrastructure/db/crm-repository.js'
import type { Db } from '../src/infrastructure/db/pool.js'
import type { CrmScope } from '../src/domain/crm-scope.js'

const USER = '22222222-2222-4222-8222-222222222222'
const OTHER = '44444444-4444-4444-8444-444444444444'
const PROSPECT = '55555555-5555-4555-8555-555555555555'
const LEAD = '66666666-6666-4666-8666-666666666666'
const OPP = '77777777-7777-4777-8777-777777777777'
const V1 = '2026-01-01T00:00:00.000Z'
const V2 = '2026-02-01T00:00:00.000Z'
const ventas: CrmScope = { userId: USER, global: false }
const admin: CrmScope = { userId: OTHER, global: true }
const gerente: CrmScope = { userId: OTHER, global: true }

type Prospect = { id: string; telefono: string | null }
type Opp = { id: string; prospecto_id: string; responsable_id: string; updated_at: string; comentarios: string | null }
type Lead = { id: string; prospecto_id: string; responsable_id: string; updated_at: string; notas: string | null; estado: string }
type Store = { prospects: Prospect[]; opps: Opp[]; leads: Lead[] }

function portfolioDb(seed: { oppOwner?: string; leadOwner?: string; leadVersion?: string; notas?: string }) {
  const committed: Store = {
    prospects: [{ id: PROSPECT, telefono: 'original' }],
    opps: seed.oppOwner
      ? [{ id: OPP, prospecto_id: PROSPECT, responsable_id: seed.oppOwner, updated_at: V1, comentarios: 'viejo' }]
      : [],
    leads: seed.leadOwner
      ? [{ id: LEAD, prospecto_id: PROSPECT, responsable_id: seed.leadOwner, updated_at: seed.leadVersion ?? V1, notas: seed.notas ?? 'vieja', estado: 'por_contactar' }]
      : [],
  }
  let working = structuredClone(committed)
  let open = false
  const view = () => (open ? working : committed)
  const query = async (sql: string, params: unknown[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (text === 'begin') {
      open = true
      working = structuredClone(committed)
      return { rows: [] }
    }
    if (text === 'commit') {
      Object.assign(committed, structuredClone(working))
      open = false
      return { rows: [] }
    }
    if (text === 'rollback') {
      working = structuredClone(committed)
      open = false
      return { rows: [] }
    }
    if (text.startsWith('select id from public.crm_prospectos where id=$1 for update')) {
      const row = view().prospects.find((item) => item.id === params[0])
      return { rows: row ? [{ id: row.id }] : [] }
    }
    if (text.startsWith('select responsable_id from public.crm_oportunidades where prospecto_id=$1')) {
      const owners = [
        ...view().opps.filter((item) => item.prospecto_id === params[0]).map((item) => ({ responsable_id: item.responsable_id })),
        ...view().leads.filter((item) => item.prospecto_id === params[0]).map((item) => ({ responsable_id: item.responsable_id })),
      ]
      return { rows: owners }
    }
    if (text.startsWith('update public.crm_prospectos set')) {
      const row = view().prospects.find((item) => item.id === params[0])
      if (row && text.includes('telefono=')) row.telefono = params[1] == null ? null : String(params[1])
      return { rows: row ? [row] : [] }
    }
    if (text.startsWith('select prospecto_id,updated_at from public.crm_oportunidades')) {
      const owner = text.includes('responsable_id') ? params[1] : undefined
      const row = view().opps.find((item) => item.id === params[0] && (owner === undefined || item.responsable_id === owner))
      return { rows: row ? [{ prospecto_id: row.prospecto_id, updated_at: row.updated_at }] : [] }
    }
    if (text.startsWith('update public.crm_oportunidades set')) {
      const row = view().opps.find((item) => item.id === params[0])
      if (row && text.includes('comentarios=')) row.comentarios = params[1] == null ? null : String(params[1])
      return { rows: [] }
    }
    if (text.startsWith('select id,estado,prospecto_id,updated_at from public.crm_leads')) {
      const owner = text.includes('responsable_id') ? params[1] : undefined
      const row = view().leads.find((item) => item.id === params[0] && (owner === undefined || item.responsable_id === owner))
      return { rows: row ? [{ id: row.id, estado: row.estado, prospecto_id: row.prospecto_id, updated_at: row.updated_at }] : [] }
    }
    if (text.startsWith('update public.crm_leads set')) {
      const row = view().leads.find((item) => item.id === params[0])
      if (row) {
        if (text.includes('notas=')) row.notas = params[1] == null ? null : String(params[1])
        row.updated_at = V2
      }
      return { rows: [] }
    }
    if (text.startsWith('select o.*') || text.startsWith('select l.*')) {
      return { rows: [{ id: params[0] }] }
    }
    throw new Error(`unexpected sql: ${text}`)
  }
  const client = { query, release() {} }
  const db = { pool: { connect: async () => client }, query } as unknown as Db
  return { repo: createCrmRepository(db), committed }
}

describe('DIN-402 prospect mutation ownership', () => {
  it('lets ventas edit a prospect referenced only by their own portfolio', async () => {
    const own = portfolioDb({ oppOwner: USER })
    await own.repo.updateProspect(PROSPECT, { telefono: '111' }, ventas)
    expect(own.committed.prospects[0]?.telefono).toBe('111')

    const viaOpp = portfolioDb({ oppOwner: USER })
    await viaOpp.repo.updateOpportunity(OPP, { updatedAt: V1, comentarios: 'nuevo', prospecto: { telefono: '222' } }, ventas)
    expect(viaOpp.committed.prospects[0]?.telefono).toBe('222')
    expect(viaOpp.committed.opps[0]?.comentarios).toBe('nuevo')

    const viaLead = portfolioDb({ leadOwner: USER })
    await viaLead.repo.updateLead(LEAD, { updatedAt: V1, notas: 'nueva', prospecto: { telefono: '333' } }, ventas)
    expect(viaLead.committed.prospects[0]?.telefono).toBe('333')
    expect(viaLead.committed.leads[0]?.notas).toBe('nueva')
  })

  it('denies ventas a foreign prospect and a prospect shared with another portfolio', async () => {
    const foreign = portfolioDb({ oppOwner: OTHER })
    await expect(foreign.repo.updateProspect(PROSPECT, { telefono: '111' }, ventas)).rejects.toMatchObject({ statusCode: 403 })
    expect(foreign.committed.prospects[0]?.telefono).toBe('original')

    const unreferenced = portfolioDb({})
    await expect(unreferenced.repo.updateProspect(PROSPECT, { telefono: '111' }, ventas)).rejects.toMatchObject({ statusCode: 403 })
    expect(unreferenced.committed.prospects[0]?.telefono).toBe('original')

    const shared = portfolioDb({ oppOwner: USER, leadOwner: OTHER })
    await expect(shared.repo.updateProspect(PROSPECT, { telefono: '111' }, ventas)).rejects.toMatchObject({ statusCode: 403 })
    await expect(shared.repo.updateOpportunity(OPP, { updatedAt: V1, comentarios: 'nuevo', prospecto: { telefono: '222' } }, ventas)).rejects.toMatchObject({ statusCode: 403 })
    await expect(shared.repo.updateLead(LEAD, { updatedAt: V1, notas: 'nueva', prospecto: { telefono: '333' } }, { userId: OTHER, global: false })).rejects.toMatchObject({ statusCode: 403 })
    expect(shared.committed.prospects[0]?.telefono).toBe('original')
    expect(shared.committed.opps[0]?.comentarios).toBe('viejo')
    expect(shared.committed.leads[0]?.notas).toBe('vieja')
  })

  it('lets admin and gerente edit a shared prospect', async () => {
    const asAdmin = portfolioDb({ oppOwner: USER, leadOwner: OTHER })
    await asAdmin.repo.updateProspect(PROSPECT, { telefono: '111' }, admin)
    expect(asAdmin.committed.prospects[0]?.telefono).toBe('111')

    const asGerente = portfolioDb({ oppOwner: USER, leadOwner: OTHER })
    await asGerente.repo.updateProspect(PROSPECT, { telefono: '222' }, gerente)
    expect(asGerente.committed.prospects[0]?.telefono).toBe('222')
  })
})

describe('DIN-402 lead optimistic concurrency', () => {
  it('rejects a stale lead update and keeps the newer lead and prospect values', async () => {
    const db = portfolioDb({ leadOwner: USER, oppOwner: USER, leadVersion: V2, notas: 'de-b' })
    db.committed.prospects[0]!.telefono = 'de-b'
    await expect(
      db.repo.updateLead(LEAD, { updatedAt: V1, notas: 'de-a', prospecto: { telefono: 'de-a' } }, ventas),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(db.committed.leads[0]?.notas).toBe('de-b')
    expect(db.committed.prospects[0]?.telefono).toBe('de-b')
  })
})

describe('DIN-402 server-side lead filters', () => {
  it('filters the full set, so a responsable absent from page 1 is returned on page 1 of the filtered query', async () => {
    const leads = Array.from({ length: 75 }, (_, index) => ({
      id: `88888888-8888-4888-8888-${String(index).padStart(12, '0')}`,
      responsable_id: index < 50 ? OTHER : USER,
      estado: 'por_contactar',
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 75 - index)).toISOString(),
      nombre: index < 50 ? 'Ajeno' : 'Propio',
    }))
    const query = async (sql: string, params: unknown[] = []) => {
      const text = sql.replace(/\s+/g, ' ').trim().toLowerCase()
      let rows = [...leads]
      let cursor = 0
      if (text.includes('l.responsable_id=$')) {
        const owner = params[cursor++]
        rows = rows.filter((row) => row.responsable_id === owner)
      }
      if (text.includes('l.estado=$')) {
        const estado = params[cursor++]
        rows = rows.filter((row) => row.estado === estado)
      }
      if (text.includes('p.nombre ilike')) {
        const term = String(params[cursor++] ?? '').replaceAll('%', '').toLowerCase()
        rows = rows.filter((row) => row.nombre.toLowerCase().includes(term))
      }
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      if (text.startsWith('select count(*)::text count')) return { rows: [{ count: String(rows.length) }] }
      const offset = Number(params.at(-2))
      const limit = Number(params.at(-1))
      return { rows: rows.slice(offset, offset + limit) }
    }
    const repo = createCrmRepository({ query } as unknown as Db)
    const unfiltered = await repo.listLeads({ page: 1, pageSize: 50 }, admin)
    expect(unfiltered.total).toBe(75)
    expect(unfiltered.items).toHaveLength(50)
    expect(unfiltered.items.some((item) => item.responsable_id === USER)).toBe(false)

    const filtered = await repo.listLeads({ page: 1, pageSize: 50, responsableId: USER }, admin)
    expect(filtered.total).toBe(25)
    expect(filtered.items).toHaveLength(25)
    expect(filtered.items.every((item) => item.responsable_id === USER)).toBe(true)

    const scoped = await repo.listLeads({ page: 1, pageSize: 50, responsableId: OTHER }, ventas)
    expect(scoped.total).toBe(25)
    expect(scoped.items.every((item) => item.responsable_id === USER)).toBe(true)
  })
})

describe('DIN-402 lead follow-up contract', () => {
  it('types lead follow-up pages separately from opportunity follow-ups', () => {
    const types = readFileSync(new URL('../../../src/lib/api/generated/types.ts', import.meta.url), 'utf8')
    const client = readFileSync(new URL('../../../src/lib/api/generated/client.ts', import.meta.url), 'utf8')
    const page = readFileSync(new URL('../../../src/app/ventas/leads/[id]/page.tsx', import.meta.url), 'utf8')
    const compact = (value) => value.replace(/\s+/g, '').replace(/;/g, '')
    expect(compact(types)).toContain(compact('export type CrmLeadFollowUpPage = {items:CrmLeadFollowUp[];page:number;pageSize:number;total:number}'))
    expect(client).toContain('listCrmLeadFollowUps: (id:string,query?:{page?:number;pageSize?:number}) => Promise<CrmLeadFollowUpPage>')
    expect(client).not.toContain('listCrmLeadFollowUps: (id:string,query?:{page?:number;pageSize?:number}) => Promise<CrmFollowUpPage>')
    expect(page).not.toContain('as unknown')
  })
})
