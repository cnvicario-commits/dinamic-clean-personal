import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { buildApp } from '../src/app.js'
import { createAttendanceRepository } from '../src/infrastructure/db/attendance-repository.js'
import { createAuditsRepository } from '../src/infrastructure/db/audits-repository.js'
import type { ClientsRepository } from '../src/infrastructure/db/clients-repository.js'
import type { Db } from '../src/infrastructure/db/pool.js'
import type { ResultsRepository } from '../src/infrastructure/db/results-repository.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'

const USER = '22222222-2222-4222-8222-222222222222'
const ID = '33333333-3333-4333-8333-333333333333'
const apps: FastifyInstance[] = []

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())))

function pgError(code: string, constraint?: string) {
  return Object.assign(new Error('duplicate key value violates unique constraint "secret_table"'), {
    code,
    constraint,
    detail: 'Key (id)=(1) already exists.',
    query: 'insert into secret_table values (1)',
  })
}

function emptyResult(): pg.QueryResult {
  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] }
}

function throwingDb(error: unknown): Db {
  const base = createProfileStubDb({
    profile: { id: USER, nombre_completo: 'User', rol: 'admin' },
  })
  const client = {
    async query(text: string) {
      const sql = String(text).trim().toLowerCase()
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return emptyResult()
      throw error
    },
    release() {},
  }
  return {
    ...base,
    pool: { connect: async () => client } as unknown as pg.Pool,
    async query(text, params) {
      const sql = text.replace(/\s+/g, ' ').toLowerCase()
      if (sql.includes('from public.perfiles') || sql.includes('from auth.users')) {
        return base.query(text, params)
      }
      throw error
    },
  }
}

async function start(options: Parameters<typeof buildApp>[1] = {}) {
  const app = await buildApp(testEnv(), {
    db: throwingDb(pgError('23503')),
    ...options,
  })
  apps.push(app)
  await app.ready()
  return app
}

async function auth() {
  return { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
}

function expectClientSafe(body: string, status: number) {
  expect(status).not.toBe(500)
  expect(status).not.toBe(502)
  expect(body).not.toMatch(/secret_table|insert into/i)
}

describe('postgres constraint HTTP mapping', () => {
  it('maps attendance foreign keys to 400 and 404', async () => {
    const headers = await auth()
    const payload = { empleadoId: ID, fecha: '2026-10-01', codigo: 'P' }
    const attendance = async (constraint: string) => {
      const app = await start({
        attendanceRepo: {
          list: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
          listCodes: async () => [{ codigo: 'P', descripcion: 'Presente' }],
          upsert: async () => {
            throw pgError('23503', constraint)
          },
        } as unknown as ReturnType<typeof createAttendanceRepository>,
      })
      return app.inject({ method: 'PUT', url: '/v1/attendance', headers, payload })
    }
    const code = await attendance('asistencias_codigo_fkey')
    expect(code.statusCode).toBe(400)
    expect(code.json()).toMatchObject({ code: 'bad_request', detail: 'Unknown attendance code' })
    expectClientSafe(code.body, code.statusCode)
    const employee = await attendance('asistencias_empleado_id_fkey')
    expect(employee.statusCode).toBe(404)
    expect(employee.json()).toMatchObject({ code: 'not_found', detail: 'Employee not found' })
    expectClientSafe(employee.body, employee.statusCode)
  })

  it('maps catalog, purchases, crm, and audits writes away from 500', async () => {
    const app = await start()
    const headers = await auth()
    const catalog = await app.inject({
      method: 'POST',
      url: '/v1/suppliers',
      headers,
      payload: { razonSocial: 'ACME', cuit: '30' },
    })
    expect(catalog.statusCode).toBe(400)
    expect(catalog.json().code).toBe('bad_request')
    expectClientSafe(catalog.body, catalog.statusCode)

    const purchase = await app.inject({
      method: 'POST',
      url: '/v1/purchase-requests',
      headers,
      payload: { empresaId: ID, clienteId: ID, items: [{ articuloId: ID, cantidad: 1 }] },
    })
    expect(purchase.statusCode).toBe(400)
    expect(purchase.json().code).toBe('bad_request')
    expectClientSafe(purchase.body, purchase.statusCode)

    const crm = await app.inject({
      method: 'POST',
      url: '/v1/crm/tipos-cliente',
      headers,
      payload: { nombre: 'Tipo' },
    })
    expect(crm.statusCode).toBe(400)
    expect(crm.json().code).toBe('bad_request')
    expectClientSafe(crm.body, crm.statusCode)

    const audit = await app.inject({
      method: 'POST',
      url: '/v1/audits/plannings',
      headers,
      payload: { aliasId: ID, fechaPropuesta: '2026-10-01', supervisorId: ID },
    })
    expect(audit.statusCode).toBe(400)
    expect(audit.json().code).toBe('bad_request')
    expectClientSafe(audit.body, audit.statusCode)
  })

  it('maps clients, employees, and assignments writes away from 502', async () => {
    const headers = await auth()
    const clients = await (
      await start({
        clientsRepo: {
          create: async () => {
            throw pgError('23502')
          },
        } as unknown as ClientsRepository,
      })
    ).inject({ method: 'POST', url: '/v1/clients', headers, payload: { nombre: 'Cliente' } })
    expect(clients.statusCode).toBe(400)
    expect(clients.json().code).toBe('bad_request')
    expectClientSafe(clients.body, clients.statusCode)

    const employees = await (
      await start({ db: throwingDb(pgError('23505', 'empleados_cuil_key')) })
    ).inject({
      method: 'POST',
      url: '/v1/employees',
      headers,
      payload: { nombreApellido: 'Ana', cuil: '20-1', horasContrato: 8, empresa: 'DINAMIC' },
    })
    expect(employees.statusCode).toBe(409)
    expect(employees.json()).toMatchObject({
      code: 'conflict',
      detail: 'An employee with this CUIL already exists',
    })
    expectClientSafe(employees.body, employees.statusCode)

    const assignments = await (
      await start({ db: throwingDb(pgError('23503', 'asignaciones_empleado_id_fkey')) })
    ).inject({
      method: 'POST',
      url: '/v1/assignments',
      headers,
      payload: { empleadoId: ID, clienteId: ID, fechaDesde: '2026-10-01' },
    })
    expect(assignments.statusCode).toBe(404)
    expect(assignments.json()).toMatchObject({ code: 'not_found', detail: 'Employee not found' })
    expectClientSafe(assignments.body, assignments.statusCode)
  })

  it('maps a results import constraint to 400 and rejects a non-uuid id before the repository', async () => {
    const detail = vi.fn(async () => {
      throw new Error('repository should not run')
    })
    const app = await start({
      resultsRepo: {
        list: async () => [],
        detail,
        preview: async () => ({ total: 0, valid: 0, invalid: 0, newRows: 0, updates: 0, duplicates: [], errors: [] }),
        apply: async () => {
          throw pgError('23503')
        },
      } as unknown as ResultsRepository,
    })
    const headers = await auth()
    const applied = await app.inject({
      method: 'POST',
      url: '/v1/results/import/apply',
      headers: { ...headers, 'idempotency-key': 'results-pg-key' },
      payload: { rows: [{ anio: 2026, mes: 1, values: { total_ventas: 1 }, details: [] }] },
    })
    expect(applied.statusCode).toBe(400)
    expect(applied.json().code).toBe('bad_request')
    expectClientSafe(applied.body, applied.statusCode)

    const missing = await app.inject({ method: 'GET', url: '/v1/results/not-a-uuid', headers })
    expect(missing.statusCode).toBe(400)
    expect(missing.json()).toMatchObject({ code: 'bad_request', detail: 'Invalid results id' })
    expect(detail).not.toHaveBeenCalled()
  })

  it('maps an audits repository rejection through the error handler', async () => {
    const app = await start({
      auditsRepo: {
        createPlanning: async () => {
          throw pgError('23514')
        },
      } as unknown as ReturnType<typeof createAuditsRepository>,
    })
    const response = await app.inject({
      method: 'POST',
      url: '/v1/audits/plannings',
      headers: await auth(),
      payload: { aliasId: ID, fechaPropuesta: '2026-10-01', supervisorId: ID },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('bad_request')
    expectClientSafe(response.body, response.statusCode)
  })
})
