import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'
import type { PurchasesRepository } from '../src/infrastructure/db/purchases-repository.js'
import { notFound } from '../src/http/errors/app-error.js'

const USER = '22222222-2222-4222-8222-222222222222'
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'
const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function purchasesRepo(): PurchasesRepository {
  return {
    catalogs: vi.fn(),
    listRequests: vi.fn(async () => []),
    requestDetail: vi.fn(async (id: string) => {
      if (id === UNKNOWN_ID) throw notFound('Purchase request not found')
      return { id, pedidos_compra_items: [] }
    }),
    saveRequest: vi.fn(),
    transition: vi.fn(),
    createOrder: vi.fn(),
    orderDetail: vi.fn(),
    warehouseDetail: vi.fn(),
    listOrders: vi.fn(async () => []),
    listWarehouses: vi.fn(async () => []),
    applyAssignments: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
    duplicate: vi.fn(),
    discard: vi.fn(),
  } as unknown as PurchasesRepository
}

async function app(role: string, repo = purchasesRepo()) {
  const instance = await buildApp(testEnv(), {
    db: createProfileStubDb({ profile: { id: USER, nombre_completo: 'User', rol: role } }),
    purchasesRepo: repo,
  })
  apps.push(instance)
  await instance.ready()
  return instance
}

async function auth() {
  return { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
}

describe('RBAC and opaque resource access (HTTP)', () => {
  it('returns 404 for unknown purchase request without SQL leakage', async () => {
    const a = await app('compras')
    const headers = await auth()
    const response = await a.inject({
      method: 'GET',
      url: `/v1/purchase-requests/${UNKNOWN_ID}`,
      headers,
    })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'not_found' })
    expect(response.body).not.toContain('select ')
  })

  it('denies supervisor from purchase mutations (role boundary)', async () => {
    const a = await app('supervisor')
    const headers = await auth()
    const response = await a.inject({
      method: 'POST',
      url: '/v1/purchase-requests',
      headers,
      payload: {
        empresaId: '22222222-2222-4222-8222-222222222222',
        clienteId: '33333333-3333-4333-8333-333333333333',
        items: [{ articuloId: '44444444-4444-4444-8444-444444444444', cantidad: 1 }],
      },
    })
    expect(response.statusCode).toBe(403)
  })
})
