import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { createMockDb, signAccessToken, testEnv } from './helpers.js'

const actorId = '22222222-2222-2222-2222-222222222222'
const employeeId = '33333333-3333-4333-8333-333333333333'
const clientId = '44444444-4444-4444-8444-444444444444'
const assignmentId = '55555555-5555-4555-8555-555555555555'
const apps: FastifyInstance[] = []

function result(rows: unknown[]) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }
}

async function appFor(role = 'admin', overrides: { duplicateCuil?: boolean; employeeMissing?: boolean; assignmentFk?: 'employee' | 'client'; closeOutcome?: 'closed' | 'already_closed' | 'missing' } = {}) {
  const seen: { sql: string; params?: unknown[] }[] = []
  const db = createMockDb({
    async query(text, params) {
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase()
      seen.push({ sql, params })
      if (sql.includes('from public.perfiles')) return result([{ id: actorId, nombre_completo: 'Actor', rol: role }])
      if (sql.includes('from auth.users')) return result([{ banned_until: null, deleted_at: null }])
      if (sql.includes('count(*)') && sql.includes('public.empleados')) return result([{ count: '1' }])
      if (sql.startsWith('select e.id') && sql.includes('from public.empleados e')) return result([{
        id: employeeId, nombre_apellido: 'Ana Demo', cuil: '20-1', fecha_ingreso: null,
        horas_contrato: 8, activo: true,
      }])
      if (sql.includes('where a.empleado_id = any')) return result([])
      if (sql.startsWith('insert into public.empleados')) {
        if (overrides.duplicateCuil) throw { code: '23505', constraint: 'empleados_cuil_key' }
        return result([{ id: employeeId, nombre_apellido: params?.[0], cuil: params?.[1], fecha_ingreso: params?.[3], horas_contrato: params?.[4], activo: true }])
      }
      if (sql.startsWith('update public.empleados')) return result(overrides.employeeMissing ? [] : [{
        id: employeeId, nombre_apellido: 'Ana Demo', cuil: '20-1', fecha_ingreso: null,
        horas_contrato: 8, activo: params?.[1],
      }])
      if (sql.includes('count(*)') && sql.includes('public.asignaciones')) return result([{ count: '1' }])
      if (sql.startsWith('select a.id') && sql.includes('from public.asignaciones a')) return result([{
        id: assignmentId, empleado_id: employeeId, empleado_nombre: 'Ana Demo',
        cliente_id: clientId, cliente_nombre: 'Cliente', fecha_desde: '2026-09-01', fecha_hasta: null,
      }])
      if (sql.startsWith('with inserted as')) {
        if (overrides.assignmentFk) throw {
          code: '23503',
          constraint: overrides.assignmentFk === 'employee'
            ? 'asignaciones_empleado_id_fkey'
            : 'asignaciones_cliente_id_fkey',
        }
        return result([{
        id: assignmentId, empleado_id: employeeId, empleado_nombre: 'Ana Demo',
        cliente_id: clientId, cliente_nombre: 'Cliente', fecha_desde: params?.[2], fecha_hasta: null,
        }])
      }
      if (sql.startsWith('with updated as')) {
        if (overrides.closeOutcome === 'missing') return result([])
        return result([{
          id: assignmentId, empleado_id: employeeId, empleado_nombre: 'Ana Demo',
          cliente_id: clientId, cliente_nombre: 'Cliente', fecha_desde: '2026-09-01',
          fecha_hasta: '2026-09-23', outcome: overrides.closeOutcome ?? 'closed',
        }])
      }
      if (sql.includes('select id, nombre_apellido') && sql.includes('public.empleados')) return result([{ id: employeeId, nombre_apellido: 'Ana Demo' }])
      if (sql.includes('select id, nombre') && sql.includes('public.clientes')) return result([{ id: clientId, nombre: 'Cliente' }])
      return result([])
    },
  })
  const app = await buildApp(testEnv(), { db })
  await app.ready()
  apps.push(app)
  return { app, seen }
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function token() { return signAccessToken({ sub: actorId }) }

describe('Phase 3A employees', () => {
  it('lists with server-side pagination, search, status and client filters', async () => {
    const { app, seen } = await appFor()
    const res = await app.inject({ method: 'GET', url: `/v1/employees?page=2&pageSize=10&activo=true&search=Ana&clienteId=${clientId}`, headers: { authorization: `Bearer ${await token()}` } })
    expect(res.statusCode).toBe(200)
    expect(seen.some((query) => query.sql.includes('nombre_apellido ilike'))).toBe(true)
    expect(seen.some((query) => query.sql.includes('af.cliente_id'))).toBe(true)
  })

  it('creates a valid employee and trims CUIL/name', async () => {
    const { app, seen } = await appFor()
    const res = await app.inject({ method: 'POST', url: '/v1/employees', headers: { authorization: `Bearer ${await token()}` }, payload: {
      nombreApellido: ' Ana Demo ', cuil: ' 20-1 ', horasContrato: 8, empresa: 'DINAMIC',
    } })
    expect(res.statusCode).toBe(201)
    const insert = seen.find((query) => query.sql.startsWith('insert into public.empleados'))
    expect(insert?.params?.slice(0, 2)).toEqual(['Ana Demo', '20-1'])
  })

  it.each([
    [{ nombreApellido: '', cuil: '20-1', horasContrato: 8, empresa: 'DINAMIC' }],
    [{ nombreApellido: 'Ana', cuil: '20-1', horasContrato: 6, empresa: 'DINAMIC' }],
    [{ nombreApellido: 'Ana', cuil: '20-1', horasContrato: 8, empresa: 'OTRA' }],
    [{ nombreApellido: 'Ana', cuil: '20-1', horasContrato: 8, empresa: 'DINAMIC', unknown: true }],
  ])('rejects invalid employee payload %#', async (payload) => {
    const { app } = await appFor()
    const res = await app.inject({ method: 'POST', url: '/v1/employees', headers: { authorization: `Bearer ${await token()}` }, payload })
    expect(res.statusCode).toBe(400)
  })

  it('maps duplicate CUIL to stable 409 without SQL details', async () => {
    const { app } = await appFor('admin', { duplicateCuil: true })
    const res = await app.inject({ method: 'POST', url: '/v1/employees', headers: { authorization: `Bearer ${await token()}` }, payload: {
      nombreApellido: 'Ana', cuil: '20-1', horasContrato: 8, empresa: 'DINAMIC',
    } })
    expect(res.statusCode).toBe(409)
    expect(res.body).not.toContain('23505')
  })

  it('updates status and returns 404 for missing employee', async () => {
    const first = await appFor()
    expect((await first.app.inject({ method: 'PATCH', url: `/v1/employees/${employeeId}/status`, headers: { authorization: `Bearer ${await token()}` }, payload: { activo: false } })).statusCode).toBe(200)
    const missing = await appFor('admin', { employeeMissing: true })
    expect((await missing.app.inject({ method: 'PATCH', url: `/v1/employees/${employeeId}/status`, headers: { authorization: `Bearer ${await token()}` }, payload: { activo: true } })).statusCode).toBe(404)
  })
})

describe('Phase 3A assignments', () => {
  it('lists and creates assignments without overlap restrictions', async () => {
    const { app } = await appFor()
    expect((await app.inject({ method: 'GET', url: '/v1/assignments?page=1&pageSize=25', headers: { authorization: `Bearer ${await token()}` } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/v1/assignments', headers: { authorization: `Bearer ${await token()}` }, payload: {
      empleadoId: employeeId, clienteId: clientId, fechaDesde: '2026-09-01',
    } })).statusCode).toBe(201)
  })

  it.each(['not-a-date', '2026-02-30'])('rejects invalid assignment date %s', async (fechaDesde) => {
    const { app } = await appFor()
    const res = await app.inject({ method: 'POST', url: '/v1/assignments', headers: { authorization: `Bearer ${await token()}` }, payload: { empleadoId: employeeId, clienteId: clientId, fechaDesde } })
    expect(res.statusCode).toBe(400)
  })

  it.each([['employee', 'Employee not found'], ['client', 'Client not found']] as const)('maps missing %s FK to 404', async (assignmentFk, detail) => {
    const { app } = await appFor('admin', { assignmentFk })
    const res = await app.inject({ method: 'POST', url: '/v1/assignments', headers: { authorization: `Bearer ${await token()}` }, payload: {
      empleadoId: employeeId, clienteId: clientId, fechaDesde: '2026-09-01',
    } })
    expect(res.statusCode).toBe(404)
    expect(res.json().detail).toBe(detail)
  })

  it('closes once and returns stable 409 without overwriting an existing close', async () => {
    const closed = await appFor('admin', { closeOutcome: 'closed' })
    expect((await closed.app.inject({ method: 'PATCH', url: `/v1/assignments/${assignmentId}/close`, headers: { authorization: `Bearer ${await token()}` } })).statusCode).toBe(200)
    const repeated = await appFor('admin', { closeOutcome: 'already_closed' })
    const second = await repeated.app.inject({ method: 'PATCH', url: `/v1/assignments/${assignmentId}/close`, headers: { authorization: `Bearer ${await token()}` } })
    expect(second.statusCode).toBe(409)
    expect(second.json().details.fechaHasta).toBe('2026-09-23')
  })
})

describe('Phase 3A minimal catalogs', () => {
  it('queries only the requested catalog', async () => {
    const clientsOnly = await appFor()
    const response = await clientsOnly.app.inject({
      method: 'GET', url: '/v1/hr/catalogs?include=clients',
      headers: { authorization: `Bearer ${await token()}` },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().employees).toEqual([])
    expect(clientsOnly.seen.some((query) => query.sql.includes('public.empleados'))).toBe(false)
    expect(clientsOnly.seen.some((query) => query.sql.includes('public.clientes'))).toBe(true)
  })

  it('rejects missing or unknown includes', async () => {
    const { app } = await appFor()
    expect((await app.inject({ method: 'GET', url: '/v1/hr/catalogs', headers: { authorization: `Bearer ${await token()}` } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'GET', url: '/v1/hr/catalogs?include=unknown', headers: { authorization: `Bearer ${await token()}` } })).statusCode).toBe(400)
  })
})

describe('Phase 3A RBAC', () => {
  const routes = [
    ['POST', '/v1/employees', { nombreApellido: 'Ana', cuil: '20-1', horasContrato: 8, empresa: 'DINAMIC' }],
    ['PATCH', `/v1/employees/${employeeId}/status`, { activo: false }],
    ['GET', '/v1/assignments', undefined],
    ['POST', '/v1/assignments', { empleadoId: employeeId, clienteId: clientId, fechaDesde: '2026-09-01' }],
    ['PATCH', `/v1/assignments/${assignmentId}/close`, undefined],
    ['GET', '/v1/hr/catalogs?include=employees,clients', undefined],
  ] as const

  it('allows admin and gerente', async () => {
    for (const role of ['admin', 'gerente']) for (const [method, url, payload] of routes) {
      const { app } = await appFor(role)
      const res = await app.inject({ method, url, headers: { authorization: `Bearer ${await token()}` }, ...(payload ? { payload } : {}) })
      expect(res.statusCode, `${role} ${method} ${url}`).toBeLessThan(400)
    }
  })

  it('denies compras and unauthenticated callers', async () => {
    for (const [method, url, payload] of routes) {
      const denied = await appFor('compras')
      expect((await denied.app.inject({ method, url, headers: { authorization: `Bearer ${await token()}` }, ...(payload ? { payload } : {}) })).statusCode).toBe(403)
      const anonymous = await appFor()
      expect((await anonymous.app.inject({ method, url, ...(payload ? { payload } : {}) })).statusCode).toBe(401)
    }
  })
})
