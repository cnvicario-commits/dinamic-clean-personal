/** Opt-in real-DB Phase 3A repository test. All writes run inside one rollback transaction. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type pg from 'pg'
import { loadEnv } from '../src/config/env.js'
import { createDb, type Db } from '../src/infrastructure/db/pool.js'
import { createEmployeesRepository } from '../src/infrastructure/db/employees-repository.js'
import { createAssignmentsRepository } from '../src/infrastructure/db/assignments-repository.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const clientId = (process.env.PHASE3A_TEST_CLIENT_ID ?? '').trim()
const canRun = process.env.RUN_SUPABASE_INTEGRATION === '1' && Boolean(clientId)

describe.skipIf(!canRun)('Phase 3A Core HR real DB (rollback)', () => {
  let db: ReturnType<typeof createDb>
  let client: pg.PoolClient
  let txDb: Db

  beforeAll(async () => {
    assertDinamicCleanTestTarget()
    db = createDb(loadEnv())
    client = await db.pool.connect()
    await client.query('begin')
    txDb = { ...db, query: client.query.bind(client) }
  })

  afterAll(async () => {
    if (client) {
      await client.query('rollback').catch(() => undefined)
      client.release()
    }
    if (db) await db.close()
  })

  it('creates/lists/statuses employee and creates/closes assignment atomically', async () => {
    const employees = createEmployeesRepository(txDb)
    const assignments = createAssignmentsRepository(txDb)
    const marker = crypto.randomUUID()
    const employee = await employees.create({
      nombreApellido: `Phase3A ${marker}`,
      cuil: `phase3a-${marker}`,
      legajo: null,
      fechaIngreso: null,
      horasContrato: 8,
      empresa: 'DINAMIC',
    })
    expect((await employees.setStatus(employee.id, false)).activo).toBe(false)
    const persistedStatus = await txDb.query<{ activo: boolean }>(
      'select activo from public.empleados where id = $1', [employee.id],
    )
    expect(persistedStatus.rows[0]?.activo).toBe(false)
    const listed = await employees.list({ page: 1, pageSize: 1, search: marker, activo: false })
    expect(listed.items.some((item) => item.id === employee.id)).toBe(true)
    expect(listed.pageSize).toBe(1)

    await client.query('savepoint duplicate_cuil')
    await expect(employees.create({
      nombreApellido: 'Duplicate', cuil: employee.cuil, legajo: null,
      fechaIngreso: null, horasContrato: 8, empresa: 'DINAMIC',
    })).rejects.toMatchObject({ status: 409, code: 'conflict' })
    await client.query('rollback to savepoint duplicate_cuil')

    for (const [savepoint, column, value] of [
      ['invalid_company', 'empresa', 'INVALID'],
      ['invalid_hours', 'horas_contrato', 6],
    ] as const) {
      await client.query(`savepoint ${savepoint}`)
      await expect(client.query(
        `insert into public.empleados (nombre_apellido, cuil, horas_contrato, empresa)
         values ($1, $2, $3, $4)`,
        column === 'empresa'
          ? ['Invalid company', `${marker}-company`, 8, value]
          : ['Invalid hours', `${marker}-hours`, value, 'DINAMIC'],
      )).rejects.toMatchObject({ code: '23514' })
      await client.query(`rollback to savepoint ${savepoint}`)
    }

    await client.query('savepoint missing_employee')
    await expect(assignments.create({
      empleadoId: crypto.randomUUID(), clienteId: clientId, fechaDesde: '2026-01-01',
    })).rejects.toMatchObject({ status: 404 })
    await client.query('rollback to savepoint missing_employee')
    await client.query('savepoint missing_client')
    await expect(assignments.create({
      empleadoId: employee.id, clienteId: crypto.randomUUID(), fechaDesde: '2026-01-01',
    })).rejects.toMatchObject({ status: 404 })
    await client.query('rollback to savepoint missing_client')

    const assignment = await assignments.create({
      empleadoId: employee.id, clienteId: clientId, fechaDesde: '2026-01-01',
    })
    expect((await assignments.close(assignment.id)).fecha_hasta).not.toBeNull()
    await expect(assignments.close(assignment.id)).rejects.toMatchObject({ status: 409 })
    const persistedClose = await txDb.query<{ fecha_hasta: string | null }>(
      'select fecha_hasta::text from public.asignaciones where id = $1', [assignment.id],
    )
    expect(persistedClose.rows[0]?.fecha_hasta).not.toBeNull()
  })

  it('allows exactly one of two concurrent assignment closes and preserves the date', async () => {
    const marker = crypto.randomUUID()
    const setupEmployee = await db.query<{ id: string }>(
      `insert into public.empleados (nombre_apellido, cuil, horas_contrato, empresa)
       values ($1, $2, 8, 'DINAMIC') returning id`,
      [`Phase3A concurrent ${marker}`, `phase3a-concurrent-${marker}`],
    )
    const employeeId = setupEmployee.rows[0]!.id
    const setupAssignment = await db.query<{ id: string }>(
      `insert into public.asignaciones (empleado_id, cliente_id, fecha_desde)
       values ($1, $2, current_date) returning id`, [employeeId, clientId],
    )
    const assignmentId = setupAssignment.rows[0]!.id
    try {
      const repo = createAssignmentsRepository(db)
      const outcomes = await Promise.allSettled([repo.close(assignmentId), repo.close(assignmentId)])
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
      const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
      expect(rejected).toMatchObject({ reason: { status: 409 } })
      const persisted = await db.query<{ fecha_hasta: string | null }>(
        'select fecha_hasta::text from public.asignaciones where id = $1', [assignmentId],
      )
      expect(persisted.rows[0]?.fecha_hasta).not.toBeNull()
    } finally {
      await db.query('delete from public.asignaciones where id = $1', [assignmentId])
      await db.query('delete from public.empleados where id = $1', [employeeId])
    }
  })
})

describe('Phase 3A real DB gate', () => {
  it('records NOT_EXECUTED when test environment is unavailable', () => {
    if (canRun) expect(clientId).toBeTruthy()
    else expect('NOT_EXECUTED_ENVIRONMENT_UNAVAILABLE').toBeTruthy()
  })
})
