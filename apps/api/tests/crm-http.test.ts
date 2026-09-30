import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'
import type { createCrmRepository } from '../src/infrastructure/db/crm-repository.js'

const USER = '22222222-2222-4222-8222-222222222222'
const ID = '33333333-3333-4333-8333-333333333333'
const apps: FastifyInstance[] = []
const opportunity = { id: ID, prospecto_id: ID, estado: 'en_seguimiento', created_at: '2026-09-30T12:00:00.000Z', updated_at: '2026-09-30T12:00:00.000Z' }

function repo(): ReturnType<typeof createCrmRepository> {
  const opportunities = Array.from({ length: 150 }, (_, index) => ({ ...opportunity, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}` }))
  return {
    list: vi.fn(async (query: { page: number; pageSize: number }) => ({ items: opportunities.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: query.page, pageSize: query.pageSize, total: opportunities.length })),
    dashboard: vi.fn(async (_actor: string, query: { page: number; pageSize: number }) => ({ items: opportunities.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: query.page, pageSize: query.pageSize, total: opportunities.length, seguimientos: [], vistas: [], novedades: [{ oportunidadId: opportunities[149]!.id, prospectoNombre: 'Último', cantidad: 1, usuarioNombreLibre: 'User', nota: 'Nueva', creadoEn: '2026-09-30T12:00:00.000Z', perfiles: null }] })),
    summary: vi.fn(async () => ({ totalCantidad: opportunities.length, totalMonto: 150, porEstado: [{ estado: 'en_seguimiento', cantidad: opportunities.length, monto: 150 }], porTipoCliente: [], porReferidor: [], montoAceptado: 0, tasaConversion: null, comisionTotal: 0, comisionLiquidada: 0, comisionPendiente: 0 })),
    detail: vi.fn(async () => opportunity),
    catalogs: vi.fn(async () => ({ prospectos: [], tiposServicio: [], tiposCliente: [], referidores: [], responsables: [] })),
    followUps: vi.fn(async () => ({ items: [], page: 1, pageSize: 50, total: 0 })),
    createProspect: vi.fn(async () => ({ id: ID, nombre: 'Prospecto' })),
    updateProspect: vi.fn(async () => ({ id: ID, nombre: 'Prospecto' })),
    createOpportunity: vi.fn(async () => ({ replayed: false, response: opportunity })),
    updateOpportunity: vi.fn(async () => opportunity),
    transition: vi.fn(async () => opportunity),
    createFollowUp: vi.fn(async () => ({ id: ID, oportunidad_id: ID })),
    deleteOpportunity: vi.fn(async () => undefined),
    markViewed: vi.fn(async () => ({ id: ID })),
    catalog: vi.fn(() => ({ list: vi.fn(async () => []), create: vi.fn(async () => ({ id: ID, nombre: 'Tipo' })), status: vi.fn(async () => ({ id: ID, activo: false })) })),
  } as unknown as ReturnType<typeof createCrmRepository>
}

async function app(role: string) {
  const instance = await buildApp(testEnv(), { db: createProfileStubDb({ profile: { id: USER, nombre_completo: 'User', rol: role } }), crmRepo: repo() })
  apps.push(instance)
  await instance.ready()
  return instance
}

async function auth() {
  return { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
}

afterEach(async () => Promise.all(apps.splice(0).map(instance => instance.close())))

describe('Phase 5A CRM HTTP/RBAC', () => {
  it.each(['admin', 'gerente'])('allows %s to read, create, update and delete CRM', async role => {
    const instance = await app(role)
    const headers = await auth()
    expect((await instance.inject({ method: 'GET', url: '/v1/crm/opportunities', headers })).statusCode).toBe(200)
    expect((await instance.inject({ method: 'POST', url: '/v1/crm/prospects', headers, payload: { nombre: 'Prospecto' } })).statusCode).toBe(201)
    expect((await instance.inject({ method: 'PATCH', url: `/v1/crm/opportunities/${ID}`, headers, payload: { updatedAt: opportunity.updated_at, comentarios: 'Cambio' } })).statusCode).toBe(200)
    expect((await instance.inject({ method: 'DELETE', url: `/v1/crm/opportunities/${ID}`, headers })).statusCode).toBe(204)
  })

  it.each(['compras', 'supervisor', 'auditoria'])('denies %s CRM operations', async role => {
    const instance = await app(role)
    const headers = await auth()
    expect((await instance.inject({ method: 'GET', url: '/v1/crm/opportunities', headers })).statusCode).toBe(403)
    expect((await instance.inject({ method: 'POST', url: '/v1/crm/prospects', headers, payload: { nombre: 'Prospecto' } })).statusCode).toBe(403)
  })

  it('requires authentication and rejects invalid CRM payloads', async () => {
    const instance = await app('admin')
    expect((await instance.inject({ method: 'GET', url: '/v1/crm/opportunities' })).statusCode).toBe(401)
    const headers = await auth()
    expect((await instance.inject({ method: 'PATCH', url: `/v1/crm/opportunities/${ID}`, headers, payload: { comentarios: 'missing version' } })).statusCode).toBe(400)
    expect((await instance.inject({ method: 'PATCH', url: `/v1/crm/opportunities/${ID}/state`, headers, payload: { estado: 'inventado', updatedAt: opportunity.updated_at } })).statusCode).toBe(400)
    expect((await instance.inject({ method: 'POST', url: `/v1/crm/opportunities/${ID}/follow-ups`, headers, payload: { nota: '' } })).statusCode).toBe(400)
    expect((await instance.inject({ method: 'POST', url: '/v1/crm/tipos-cliente', headers, payload: { nombre: '', unexpected: true } })).statusCode).toBe(400)
  })

  it('keeps records beyond 100 reachable through paginated list, dashboard and summary contracts', async () => {
    const instance = await app('admin')
    const headers = await auth()
    const list = await instance.inject({ method: 'GET', url: '/v1/crm/opportunities?page=3&pageSize=50', headers })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toMatchObject({ page: 3, pageSize: 50, total: 150 })
    expect(list.json().items).toHaveLength(50)
    const dashboard = await instance.inject({ method: 'GET', url: '/v1/crm/dashboard?page=3&pageSize=50', headers })
    expect(dashboard.json()).toMatchObject({ total: 150, novedades: [expect.objectContaining({ prospectoNombre: 'Último' })] })
    const summary = await instance.inject({ method: 'GET', url: '/v1/crm/summary', headers })
    expect(summary.json()).toMatchObject({ totalCantidad: 150 })
  })
})
