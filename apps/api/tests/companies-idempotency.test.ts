import { describe, expect, it } from 'vitest'
import { AppError } from '../src/http/errors/app-error.js'
import { createCompaniesRepository } from '../src/infrastructure/db/companies-repository.js'
import type { Db } from '../src/infrastructure/db/pool.js'

type Stored = {
  actor: string
  key: string
  hash: string
  status: string
  response: unknown
}

function fakeDb() {
  const rows: Stored[] = []
  const companies: Array<{ id: string }> = []
  let seq = 0
  const query = async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim().toLowerCase()
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return { rows: [], rowCount: 0, command: sql, oid: 0, fields: [] }
    }
    if (sql.startsWith('insert into public.company_operation_idempotency')) {
      const [actor, key, hash] = params as string[]
      if (!rows.some((row) => row.actor === actor && row.key === key)) {
        rows.push({ actor, key, hash, status: 'PROCESSING', response: null })
      }
      return { rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] }
    }
    if (sql.includes('from public.company_operation_idempotency')) {
      const [actor, key] = params as string[]
      const row = rows.find((item) => item.actor === actor && item.key === key)
      return {
        rows: row ? [{ payload_hash: row.hash, status: row.status, response: row.response }] : [],
        rowCount: row ? 1 : 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      }
    }
    if (sql.startsWith('update public.company_operation_idempotency')) {
      const [actor, key, response] = params
      const row = rows.find((item) => item.actor === actor && item.key === key)
      if (row) {
        row.status = 'COMPLETED'
        row.response = response
      }
      return { rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] }
    }
    if (sql.startsWith('insert into public.empresas')) {
      seq += 1
      const company = {
        id: `company-${seq}`,
        nombre: params[0],
        cuit: params[1],
        domicilio: params[2],
        activo: true,
      }
      companies.push(company)
      return { rows: [company], rowCount: 1, command: 'INSERT', oid: 0, fields: [] }
    }
    throw new Error(`unexpected sql: ${sql}`)
  }
  const db = {
    query,
    pool: {
      connect: async () => ({ query, release() {} }),
    },
  } as unknown as Db
  return { db, companies, rows }
}

const body = { nombre: 'ACME', cuit: '30-1', domicilio: null }

describe('company create idempotency', () => {
  it('reuses one company for the same actor, key and body', async () => {
    const { db, companies } = fakeDb()
    const repo = createCompaniesRepository(db)
    const first = await repo.create(body, { actorId: 'actor-a', key: 'ABC' })
    const second = await repo.create(body, { actorId: 'actor-a', key: 'ABC' })
    expect(second).toEqual(first)
    expect(companies).toHaveLength(1)
  })

  it('conflicts when the same actor reuses a key with a different body', async () => {
    const { db, companies } = fakeDb()
    const repo = createCompaniesRepository(db)
    await repo.create(body, { actorId: 'actor-a', key: 'ABC' })
    const error = await repo.create({ ...body, nombre: 'OTRA' }, { actorId: 'actor-a', key: 'ABC' }).catch((err) => err)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ status: 409, code: 'idempotency_key_payload_mismatch' })
    expect(companies).toHaveLength(1)
  })

  it('does not collide across actors', async () => {
    const { db, companies } = fakeDb()
    const repo = createCompaniesRepository(db)
    const first = await repo.create(body, { actorId: 'actor-a', key: 'ABC' })
    const second = await repo.create(body, { actorId: 'actor-b', key: 'ABC' })
    expect(first.id).not.toBe(second.id)
    expect(companies).toHaveLength(2)
  })
})
