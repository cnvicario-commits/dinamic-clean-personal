import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'
import type { createAuditsRepository } from '../src/infrastructure/db/audits-repository.js'

const USER = '22222222-2222-4222-8222-222222222222'
const ID = '33333333-3333-4333-8333-333333333333'
const VERSION = '2026-09-30T12:00:00.000Z'
const apps: FastifyInstance[] = []

const emptyPage = { items: [], page: 1, pageSize: 50, total: 0 }
const checklist = { id: ID, updated_at: VERSION, items: [] }

const repo = (): ReturnType<typeof createAuditsRepository> =>
  ({
    plans: vi.fn(async () => emptyPage),
    planningById: vi.fn(async () => ({ id: ID, updated_at: VERSION })),
    createPlanning: vi.fn(async () => ({ id: ID })),
    updatePlanning: vi.fn(async () => ({ id: ID })),
    cancelPlanning: vi.fn(async () => ({ id: ID })),
    listAudits: vi.fn(async () => emptyPage),
    auditDetail: vi.fn(async () => ({ id: ID, respuestas: [], planes_accion: [] })),
    dashboard: vi.fn(async () => ({ sitios_auditados: 0 })),
    catalogs: vi.fn(async () => ({ clientes: [], domicilios: [], supervisores: [] })),
    submit: vi.fn(async () => ({ replayed: false, response: { id: ID } })),
    listActionsForAudit: vi.fn(async () => []),
    listActions: vi.fn(async () => emptyPage),
    createAction: vi.fn(async () => ({ id: ID })),
    updateAction: vi.fn(async () => ({ id: ID })),
    listChecklists: vi.fn(async () => []),
    checklistDetail: vi.fn(async () => checklist),
    checklistActive: vi.fn(async () => checklist),
    checklistCreate: vi.fn(async () => ({ id: ID })),
    checklistUpdate: vi.fn(async () => checklist),
    checklistCopy: vi.fn(async () => ({ replayed: false, response: checklist })),
    checklistActivate: vi.fn(async () => ({ id: ID, activa: true })),
  }) as unknown as ReturnType<typeof createAuditsRepository>

async function app(role: string) {
  const instance = await buildApp(testEnv(), {
    db: createProfileStubDb({ profile: { id: USER, nombre_completo: 'User', rol: role } }),
    auditsRepo: repo(),
  })
  apps.push(instance)
  await instance.ready()
  return instance
}

async function auth() {
  return { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
}

afterEach(async () => Promise.all(apps.splice(0).map(a => a.close())))

const planning = { aliasId: ID, fechaPropuesta: '2026-10-01', supervisorId: ID }

const readPaths = [
  ['GET', '/v1/audits/dashboard'],
  ['GET', '/v1/audits/catalogs'],
  ['GET', '/v1/audits/plannings'],
  ['GET', `/v1/audits/plannings/${ID}`],
  ['GET', '/v1/audits'],
  ['GET', `/v1/audits/${ID}`],
  ['GET', `/v1/audits/${ID}/actions`],
  ['GET', '/v1/audit-actions'],
  ['GET', '/v1/audit-checklists'],
  ['GET', '/v1/audit-checklists/active'],
  ['GET', `/v1/audit-checklists/${ID}`],
] as const

const createPaths = [
  ['POST', '/v1/audits/plannings', planning],
  [
    'POST',
    '/v1/audits',
    {
      aliasId: ID,
      plantillaId: ID,
      fechaRealizada: '2026-10-01',
      supervisorId: ID,
      respuestas: [{ itemId: ID, resultado: 'conforme' }],
    },
    { 'idempotency-key': 'k1' },
  ],
  ['POST', `/v1/audits/${ID}/actions`, { descripcion: 'Acción' }],
] as const

const updatePaths = [
  [
    'PATCH',
    `/v1/audits/plannings/${ID}`,
    { ...planning, updatedAt: VERSION },
  ],
  ['POST', `/v1/audits/plannings/${ID}/cancel`, { updatedAt: VERSION }],
  ['PATCH', `/v1/audit-actions/${ID}`, { updatedAt: VERSION, estado: 'en_curso' }],
] as const

const managePaths = [
  [
    'POST',
    '/v1/audit-checklists',
    {
      codigoFormulario: 'FR',
      version: '1',
      vigenciaDesde: '2026-01-01',
      items: [{ orden: 1, texto: 'Ítem' }],
    },
  ],
  [
    'PATCH',
    `/v1/audit-checklists/${ID}`,
    { updatedAt: VERSION, items: [{ orden: 1, texto: 'Ítem' }] },
  ],
  [
    'POST',
    `/v1/audit-checklists/${ID}/copy`,
    { version: '2', vigenciaDesde: '2026-02-01' },
    { 'idempotency-key': 'copy-1' },
  ],
  ['POST', `/v1/audit-checklists/${ID}/activate`, { updatedAt: VERSION }],
] as const

describe('Phase 5B audits HTTP/RBAC', () => {
  it.each(['admin', 'gerente', 'supervisor', 'auditoria'])(
    'allows %s audit read/create/update operations',
    async role => {
      const instance = await app(role)
      const headers = await auth()

      for (const [method, url] of readPaths) {
        expect((await instance.inject({ method, url, headers })).statusCode).toBe(200)
      }

      for (const [method, url, payload, extra] of createPaths) {
        const response = await instance.inject({
          method,
          url,
          headers: { ...headers, ...(extra ?? {}) },
          payload,
        })
        expect(response.statusCode).toBe(201)
      }

      for (const [method, url, payload] of updatePaths) {
        expect(
          (await instance.inject({ method, url, headers, payload })).statusCode,
        ).toBe(200)
      }
    },
  )

  it('denies compras audit operations', async () => {
    const instance = await app('compras')
    const headers = await auth()
    expect((await instance.inject({ method: 'GET', url: '/v1/audits/plannings', headers })).statusCode).toBe(403)
    expect((await instance.inject({ method: 'GET', url: '/v1/audits/dashboard', headers })).statusCode).toBe(403)
    expect((await instance.inject({ method: 'GET', url: '/v1/audits', headers })).statusCode).toBe(403)
    expect((await instance.inject({ method: 'GET', url: '/v1/audit-actions', headers })).statusCode).toBe(403)
    expect((await instance.inject({ method: 'GET', url: '/v1/audit-checklists', headers })).statusCode).toBe(403)
  })

  it.each(['admin', 'gerente', 'auditoria'])(
    'allows %s checklist administration',
    async role => {
      const instance = await app(role)
      const headers = await auth()
      for (const [method, url, payload, extra] of managePaths) {
        const response = await instance.inject({
          method,
          url,
          headers: { ...headers, ...(extra ?? {}) },
          payload,
        })
        expect([200, 201]).toContain(response.statusCode)
      }
    },
  )

  it.each(['supervisor', 'compras'])('denies %s checklist administration', async role => {
    const instance = await app(role)
    const headers = await auth()
    for (const [method, url, payload, extra] of managePaths) {
      const response = await instance.inject({
        method,
        url,
        headers: { ...headers, ...(extra ?? {}) },
        payload: payload ?? {},
      })
      expect(response.statusCode).toBe(403)
    }
  })

  it('requires auth and version on planning mutation', async () => {
    const instance = await app('admin')
    expect((await instance.inject({ method: 'GET', url: '/v1/audits/plannings' })).statusCode).toBe(401)
    expect((await instance.inject({ method: 'GET', url: '/v1/audits/dashboard' })).statusCode).toBe(401)
    expect((await instance.inject({ method: 'GET', url: '/v1/audits' })).statusCode).toBe(401)
    const ok = await instance.inject({
      method: 'POST',
      url: `/v1/audits/plannings/${ID}/cancel`,
      headers: await auth(),
      payload: { updatedAt: VERSION },
    })
    expect(ok.statusCode).toBe(200)
    const bad = await instance.inject({
      method: 'POST',
      url: `/v1/audits/plannings/${ID}/cancel`,
      headers: await auth(),
      payload: {},
    })
    expect(bad.statusCode).toBe(400)
  })

  it('rejects planning ranges and unknown fields before the repository', async () => {
    const instance = await app('admin')
    const headers = await auth()
    expect(
      (
        await instance.inject({
          method: 'POST',
          url: '/v1/audits/plannings',
          headers,
          payload: { ...planning, horarioDesde: '12:00', horarioHasta: '10:00' },
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await instance.inject({
          method: 'POST',
          url: '/v1/audits/plannings',
          headers,
          payload: { ...planning, unexpected: true },
        })
      ).statusCode,
    ).toBe(400)
  })

  it('rejects unsupported planning list query params via strict schema', async () => {
    const instance = await app('admin')
    const headers = await auth()
    expect(
      (
        await instance.inject({
          method: 'GET',
          url: `/v1/audits/plannings?plantillaId=${ID}`,
          headers,
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await instance.inject({
          method: 'GET',
          url: '/v1/audits/plannings?actionState=pendiente',
          headers,
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await instance.inject({
          method: 'GET',
          url: '/v1/audits/plannings?unexpected=1',
          headers,
        })
      ).statusCode,
    ).toBe(400)
  })

  it('rejects invalid calendar dates and duplicate checklist orders', async () => {
    const instance = await app('admin')
    const headers = await auth()
    expect(
      (
        await instance.inject({
          method: 'POST',
          url: '/v1/audits/plannings',
          headers,
          payload: { ...planning, fechaPropuesta: '2026-02-30' },
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await instance.inject({
          method: 'POST',
          url: '/v1/audit-checklists',
          headers,
          payload: {
            codigoFormulario: 'FR',
            version: '1',
            vigenciaDesde: '2026-01-01',
            items: [
              { orden: 1, texto: 'A' },
              { orden: 1, texto: 'B' },
            ],
          },
        })
      ).statusCode,
    ).toBe(400)
  })
})
