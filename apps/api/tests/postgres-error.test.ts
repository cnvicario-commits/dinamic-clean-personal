import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { AppError } from '../src/http/errors/app-error.js'
import { postgresUuid } from '../src/http/schemas/postgres-uuid.js'
import { createClientBodySchema } from '../src/http/schemas/clients.js'
import { auditTx } from '../src/infrastructure/db/audits/audits-shared.js'
import { createAssignmentsRepository } from '../src/infrastructure/db/assignments-repository.js'
import { createAttendanceRepository } from '../src/infrastructure/db/attendance-repository.js'
import { createCatalogRepository } from '../src/infrastructure/db/catalog-repository.js'
import { createClientsRepository } from '../src/infrastructure/db/clients-repository.js'
import { createCrmRepository } from '../src/infrastructure/db/crm-repository.js'
import { createEmployeesRepository } from '../src/infrastructure/db/employees-repository.js'
import type { Db } from '../src/infrastructure/db/pool.js'
import { mapPostgresError, mapUnhandledPostgresError } from '../src/infrastructure/db/postgres-error.js'
import { mapProfileWriteError } from '../src/infrastructure/db/profiles-repository.js'
import { purchaseTransaction } from '../src/infrastructure/db/purchases/purchases-shared.js'
import { createResultsRepository } from '../src/infrastructure/db/results-repository.js'

const ID = '33333333-3333-4333-8333-333333333333'
const USER = '22222222-2222-4222-8222-222222222222'
const SEEDED = '00000000-0000-0000-0000-000000000001'

function pgError(code: string, constraint?: string) {
  return Object.assign(new Error('duplicate key value violates unique constraint "secret_table"'), {
    code,
    constraint,
    detail: 'Key (id)=(1) already exists.',
    query: 'insert into secret_table values (1)',
    stack: 'Error: secret stack\n    at driver',
  })
}

function emptyResult(): pg.QueryResult {
  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] }
}

function db(error: unknown): Db {
  const client = {
    async query(text: string) {
      const sql = String(text).trim().toLowerCase()
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return emptyResult()
      throw error
    },
    release() {},
  }
  return {
    pool: { connect: async () => client } as unknown as pg.Pool,
    query: async () => {
      throw error
    },
    close: async () => undefined,
    isReady: async () => true,
    checkPhase2dProfilesCapabilities: async () => {
      throw new Error('unused')
    },
    checkPhase3aCapabilities: async () => {
      throw new Error('unused')
    },
  }
}

function expectSafe(error: AppError) {
  const serialized = JSON.stringify({
    message: error.message,
    code: error.code,
    details: error.details ?? null,
  })
  expect(serialized).not.toMatch(/secret_table|insert into|secret stack/i)
}

describe('mapPostgresError', () => {
  it('maps correctable codes and connection failures without leaking driver text', () => {
    const cases = [
      ['23505', 409, 'conflict'],
      ['23503', 400, 'bad_request'],
      ['23502', 400, 'bad_request'],
      ['23514', 400, 'bad_request'],
      ['22P02', 400, 'bad_request'],
      ['08006', 503, 'service_unavailable'],
    ] as const
    for (const [code, status, stable] of cases) {
      const mapped = mapPostgresError(pgError(code))
      expect(mapped, code).toBeInstanceOf(AppError)
      expect(mapped?.status, code).toBe(status)
      expect(mapped?.code, code).toBe(stable)
      expectSafe(mapped!)
    }
  })

  it('returns null for an unknown code, a non-postgres value, and an AppError', () => {
    expect(mapPostgresError(pgError('P0001'))).toBeNull()
    expect(mapPostgresError({ message: 'not a driver error' })).toBeNull()
    expect(mapPostgresError(new AppError(400, 'bad_request', 'kept'))).toBeNull()
    expect(mapPostgresError('23503')).toBeNull()
  })

  it('does not turn an unexpected constraint into a client error at the global boundary', () => {
    expect(mapUnhandledPostgresError(pgError('23502'))).toBeNull()
    expect(mapUnhandledPostgresError(pgError('23503'))).toBeNull()
    expect(mapUnhandledPostgresError(pgError('23505'))).toBeNull()
    expect(mapUnhandledPostgresError(pgError('08006'))).toMatchObject({
      status: 503,
      code: 'service_unavailable',
    })
  })

  it('keeps a profile foreign key as an internal failure', () => {
    const mapped = mapProfileWriteError(pgError('23503', 'perfiles_id_fkey'))
    expect(mapped).toMatchObject({ status: 502, code: 'profile_write_failed' })
    expect(mapped.message).not.toMatch(/secret_table|insert into/i)
  })
})

describe('postgres uuid', () => {
  it('accepts the seeded checklist id and rejects a non-uuid', () => {
    expect(postgresUuid.safeParse(SEEDED).success).toBe(true)
    expect(postgresUuid.safeParse('not-a-uuid').success).toBe(false)
  })
})

describe('repository postgres mapping', () => {
  it('keeps a programming error out of the 4xx mapper', async () => {
    await expect(
      purchaseTransaction(db(pgError('23503')), async () => {
        throw new Error('row missing')
      }),
    ).rejects.toThrow('row missing')
  })

  it('maps purchase and audit transactions', async () => {
    await expect(
      purchaseTransaction(db(pgError('23503')), async () => {
        throw pgError('23503')
      }),
    ).rejects.toMatchObject({ status: 400, code: 'bad_request' })
    await expect(
      auditTx(db(pgError('22P02')), async () => {
        throw pgError('22P02')
      }),
    ).rejects.toMatchObject({ status: 400, code: 'bad_request' })
  })

  it('keeps employee CUIL and check constraints on their current contracts', async () => {
    const employees = createEmployeesRepository(db(pgError('23505', 'empleados_cuil_key')))
    await expect(
      employees.create({
        nombreApellido: 'Ana',
        cuil: '20-1',
        legajo: null,
        fechaIngreso: null,
        horasContrato: 8,
        empresa: 'DINAMIC',
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
      message: 'An employee with this CUIL already exists',
    })
    await expect(
      createEmployeesRepository(db(pgError('23514'))).create({
        nombreApellido: 'Ana',
        cuil: '20-1',
        legajo: null,
        fechaIngreso: null,
        horasContrato: 8,
        empresa: 'DINAMIC',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'employee_constraint_violation' })
  })

  it('maps assignment foreign keys to 404 and other constraints through the mapper', async () => {
    const body = { empleadoId: ID, clienteId: ID, fechaDesde: '2026-10-01' }
    await expect(
      createAssignmentsRepository(db(pgError('23503', 'asignaciones_empleado_id_fkey'))).create(body),
    ).rejects.toMatchObject({ status: 404, code: 'not_found', message: 'Employee not found' })
    await expect(
      createAssignmentsRepository(db(pgError('23503', 'asignaciones_cliente_id_fkey'))).create(body),
    ).rejects.toMatchObject({ status: 404, message: 'Client not found' })
    await expect(
      createAssignmentsRepository(db(pgError('22P02'))).create(body),
    ).rejects.toMatchObject({ status: 400, code: 'bad_request' })
  })

  it('maps client, catalog, crm, attendance, and results writes', async () => {
    await expect(
      createClientsRepository(db(pgError('23503'))).create(createClientBodySchema.parse({ nombre: 'Cliente' }), { actorId: USER, key: 'client-1' }),
    ).rejects.toMatchObject({ status: 400, message: 'Related client data does not exist' })
    await expect(
      createClientsRepository(db(pgError('23514'))).create(createClientBodySchema.parse({ nombre: 'Cliente' }), { actorId: USER, key: 'client-2' }),
    ).rejects.toMatchObject({ status: 400, code: 'bad_request' })

    await expect(
      createCatalogRepository(db(pgError('23505'))).createSupplier({
        razonSocial: 'ACME',
        cuit: '30',
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Catalog record conflicts with an existing unique value',
    })
    await expect(
      createCatalogRepository(db(pgError('23503'))).createSupplier({ razonSocial: 'ACME', cuit: '30' }),
    ).rejects.toMatchObject({ status: 400, code: 'bad_request' })

    await expect(
      createCrmRepository(db(pgError('23505'))).catalog('tipos-cliente').create('Tipo'),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Catalog record conflicts with an existing unique value',
    })

    const attendance = {
      empleadoId: ID,
      fecha: '2026-10-01',
      codigo: 'P',
      horasExtras: 0,
      observaciones: null,
      clienteDestinoId: null,
      clienteHorasExtraId: null,
    }
    await expect(
      createAttendanceRepository(db(pgError('23503', 'asistencias_codigo_fkey'))).upsert(attendance, USER),
    ).rejects.toMatchObject({ status: 400, message: 'Unknown attendance code' })
    await expect(
      createAttendanceRepository(db(pgError('23503', 'asistencias_empleado_id_fkey'))).upsert(attendance, USER),
    ).rejects.toMatchObject({ status: 404, message: 'Employee not found' })

    const empty = db(pgError('23503'))
    empty.query = async () => emptyResult()
    await expect(createAttendanceRepository(empty).upsert(attendance, USER)).rejects.toThrow(
      'Attendance upsert returned no row',
    )

    await expect(
      createResultsRepository(db(pgError('23514'))).apply(
        { rows: [{ anio: 2026, mes: 1, values: { total_ventas: 1 }, details: [] }] },
        'results-key',
        USER,
      ),
    ).rejects.toMatchObject({ status: 400, code: 'bad_request' })
    await expect(
      createResultsRepository(db(pgError('P0001'))).apply(
        { rows: [{ anio: 2026, mes: 1, values: { total_ventas: 1 }, details: [] }] },
        'results-key',
        USER,
      ),
    ).rejects.toMatchObject({ status: 502, code: 'results_persistence_failed' })
  })
})
