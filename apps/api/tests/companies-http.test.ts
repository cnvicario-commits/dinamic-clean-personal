import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { buildApp } from '../src/app.js'
import type { CompaniesRepository } from '../src/infrastructure/db/companies-repository.js'
import type { Db } from '../src/infrastructure/db/pool.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'

const USER = '22222222-2222-4222-8222-222222222222'
const ID = '33333333-3333-4333-8333-333333333333'
const ROW = { id: ID, nombre: 'ACME', cuit: '30-1', domicilio: null, activo: true }
const apps: FastifyInstance[] = []

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())))

function result(rows: unknown[]): pg.QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as pg.QueryResult
}

function companyDb(mode: 'ok' | 'unique' | 'missing'): Db {
  const base = createProfileStubDb({
    profile: { id: USER, nombre_completo: 'User', rol: 'admin' },
  })
  return {
    ...base,
    async query(text, params) {
      const sql = text.replace(/\s+/g, ' ').toLowerCase()
      if (sql.includes('from public.perfiles') || sql.includes('from auth.users')) {
        return base.query(text, params)
      }
      if (mode === 'unique') {
        throw Object.assign(new Error('duplicate key value violates unique constraint "secret_table"'), {
          code: '23505',
          query: 'insert into secret_table values (1)',
        })
      }
      if (mode === 'missing') return result([])
      return result([ROW])
    },
  }
}

async function start(role: string, options: Parameters<typeof buildApp>[1] = {}) {
  const app = await buildApp(testEnv(), {
    db: createProfileStubDb({ profile: { id: USER, nombre_completo: 'User', rol: role } }),
    ...options,
  })
  apps.push(app)
  await app.ready()
  return app
}

async function auth() {
  return { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
}

const payload = { nombre: 'ACME', cuit: '30-1', domicilio: '' }

describe('companies HTTP', () => {
  it('requires authentication', async () => {
    const app = await start('admin')
    expect((await app.inject({ method: 'POST', url: '/v1/companies', payload })).statusCode).toBe(401)
    expect((await app.inject({ method: 'PATCH', url: `/v1/companies/${ID}`, payload })).statusCode).toBe(401)
    expect((await app.inject({ method: 'PATCH', url: `/v1/companies/${ID}/status`, payload: { activo: false } })).statusCode).toBe(401)
  })

  it('denies every role except admin', async () => {
    for (const role of ['gerente', 'compras', 'supervisor', 'auditoria', 'ventas']) {
      const app = await start(role)
      const headers = await auth()
      expect((await app.inject({ method: 'POST', url: '/v1/companies', headers, payload })).statusCode).toBe(403)
      expect((await app.inject({ method: 'PATCH', url: `/v1/companies/${ID}`, headers, payload })).statusCode).toBe(403)
      expect((await app.inject({ method: 'PATCH', url: `/v1/companies/${ID}/status`, headers, payload: { activo: true } })).statusCode).toBe(403)
    }
  })

  it('creates, updates and changes status for admin', async () => {
    const app = await start('admin', { db: companyDb('ok') })
    const headers = await auth()
    const created = await app.inject({ method: 'POST', url: '/v1/companies', headers, payload })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ id: ID, nombre: 'ACME', activo: true })
    const updated = await app.inject({ method: 'PATCH', url: `/v1/companies/${ID}`, headers, payload })
    expect(updated.statusCode).toBe(200)
    const status = await app.inject({
      method: 'PATCH',
      url: `/v1/companies/${ID}/status`,
      headers,
      payload: { activo: false },
    })
    expect(status.statusCode).toBe(200)
  })

  it('rejects invalid payloads and ids', async () => {
    const app = await start('admin', { db: companyDb('ok') })
    const headers = await auth()
    expect((await app.inject({ method: 'POST', url: '/v1/companies', headers, payload: { nombre: ' ', cuit: '30' } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'PATCH', url: '/v1/companies/not-a-uuid', headers, payload })).statusCode).toBe(400)
    expect((await app.inject({ method: 'PATCH', url: `/v1/companies/${ID}`, headers, payload: { activo: false } })).statusCode).toBe(400)
    const status = await app.inject({
      method: 'PATCH',
      url: `/v1/companies/${ID}/status`,
      headers,
      payload: { activo: 'no' },
    })
    expect(status.statusCode).toBe(400)
    expect(status.json().code).toBe('bad_request')
  })

  it('maps a unique violation to 409 without driver text and a missing row to 404', async () => {
    const headers = await auth()
    const conflict = await (await start('admin', { db: companyDb('unique') })).inject({
      method: 'POST',
      url: '/v1/companies',
      headers,
      payload,
    })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('conflict')
    expect(conflict.body).not.toMatch(/secret_table|insert into/i)
    const missing = await (await start('admin', { db: companyDb('missing') })).inject({
      method: 'PATCH',
      url: `/v1/companies/${ID}`,
      headers,
      payload,
    })
    expect(missing.statusCode).toBe(404)
    const status = await (await start('admin', { db: companyDb('missing') })).inject({
      method: 'PATCH',
      url: `/v1/companies/${ID}/status`,
      headers,
      payload: { activo: false },
    })
    expect(status.statusCode).toBe(404)
  })

  it('keeps an unexpected repository failure as 500', async () => {
    const app = await start('admin', {
      companiesRepo: {
        create: async () => {
          throw new Error('insert into secret_table')
        },
        update: async () => ROW,
        setStatus: async () => ROW,
      } as unknown as CompaniesRepository,
    })
    const response = await app.inject({
      method: 'POST',
      url: '/v1/companies',
      headers: await auth(),
      payload,
    })
    expect(response.statusCode).toBe(500)
    expect(response.json().code).toBe('internal_error')
    expect(response.body).not.toMatch(/secret_table/)
  })
})
