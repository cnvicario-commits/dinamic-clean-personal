import type { Db } from './pool.js'
import { AppError, conflict, notFound } from '../../http/errors/app-error.js'
import type {
  CreateEmployeeBody,
  EmployeeListItem,
  EmployeesResponse,
  ListEmployeesQuery,
} from '../../http/schemas/employees.js'

type EmployeeRow = Omit<EmployeeListItem, 'asignaciones'>
type AssignmentRow = {
  empleado_id: string
  fecha_desde: string
  fecha_hasta: string | null
  cliente_id: string | null
  cliente_nombre: string | null
}

function persistenceError(error: unknown): AppError {
  const code = (error as { code?: unknown })?.code
  const constraint = (error as { constraint?: unknown })?.constraint
  if (code === '23505' && constraint === 'empleados_cuil_key') {
    return conflict('An employee with this CUIL already exists')
  }
  if (code === '23514') {
    return new AppError(400, 'employee_constraint_violation', 'Employee data violates a database constraint')
  }
  return new AppError(502, 'employee_persistence_failed', 'Employee persistence failed')
}

export type EmployeesRepository = ReturnType<typeof createEmployeesRepository>

export function createEmployeesRepository(db: Db) {
  return {
    async list(input: ListEmployeesQuery): Promise<EmployeesResponse> {
      const offset = (input.page - 1) * input.pageSize
      const params: unknown[] = []
      const where: string[] = []

      if (input.activo !== undefined) {
        params.push(input.activo)
        where.push(`e.activo = $${params.length}`)
      }
      if (input.search) {
        params.push(`%${input.search}%`)
        where.push(`e.nombre_apellido ilike $${params.length}`)
      }
      if (input.clienteId) {
        params.push(input.clienteId)
        where.push(`exists (
          select 1 from public.asignaciones af
          where af.empleado_id = e.id
            and af.cliente_id = $${params.length}
            and af.fecha_hasta is null
        )`)
      }

      const whereSql = where.length ? `where ${where.join(' and ')}` : ''
      const countResult = await db.query<{ count: string }>(
        `select count(*)::text as count from public.empleados e ${whereSql}`,
        params,
      )
      const total = Number.parseInt(countResult.rows[0]?.count ?? '0', 10)
      const listParams = [...params, input.pageSize, offset]
      const limitIdx = listParams.length - 1
      const offsetIdx = listParams.length
      const employees = await db.query<EmployeeRow>(
        `select e.id, e.nombre_apellido, e.cuil, e.fecha_ingreso::text,
                e.horas_contrato, e.activo
         from public.empleados e
         ${whereSql}
         order by e.nombre_apellido asc, e.id asc
         limit $${limitIdx} offset $${offsetIdx}`,
        listParams,
      )

      const ids = employees.rows.map((employee) => employee.id)
      const assignmentsByEmployee = new Map<string, EmployeeListItem['asignaciones']>()
      if (ids.length > 0) {
        const assignments = await db.query<AssignmentRow>(
          `select a.empleado_id, a.fecha_desde::text, a.fecha_hasta::text,
                  c.id as cliente_id, c.nombre as cliente_nombre
           from public.asignaciones a
           left join public.clientes c on c.id = a.cliente_id
           where a.empleado_id = any($1::uuid[])
           order by a.fecha_desde desc, a.id desc`,
          [ids],
        )
        for (const row of assignments.rows) {
          const current = assignmentsByEmployee.get(row.empleado_id) ?? []
          current.push({
            fecha_desde: row.fecha_desde,
            fecha_hasta: row.fecha_hasta,
            clientes:
              row.cliente_id && row.cliente_nombre
                ? { id: row.cliente_id, nombre: row.cliente_nombre }
                : null,
          })
          assignmentsByEmployee.set(row.empleado_id, current)
        }
      }

      return {
        items: employees.rows.map((employee) => ({
          ...employee,
          asignaciones: assignmentsByEmployee.get(employee.id) ?? [],
        })),
        page: input.page,
        pageSize: input.pageSize,
        total,
      }
    },

    async create(input: CreateEmployeeBody): Promise<EmployeeRow> {
      try {
        const result = await db.query<EmployeeRow>(
          `insert into public.empleados
             (nombre_apellido, cuil, legajo, fecha_ingreso, horas_contrato, empresa)
           values ($1, $2, $3, $4, $5, $6)
           returning id, nombre_apellido, cuil, fecha_ingreso::text,
                     horas_contrato, activo`,
          [
            input.nombreApellido,
            input.cuil,
            input.legajo,
            input.fechaIngreso,
            input.horasContrato,
            input.empresa,
          ],
        )
        const row = result.rows[0]
        if (!row) throw new AppError(502, 'employee_create_empty', 'Employee persistence failed')
        return row
      } catch (error) {
        if (error instanceof AppError) throw error
        throw persistenceError(error)
      }
    },

    async setStatus(id: string, activo: boolean): Promise<EmployeeRow> {
      try {
        const result = await db.query<EmployeeRow>(
          `update public.empleados
           set activo = $2
           where id = $1
           returning id, nombre_apellido, cuil, fecha_ingreso::text,
                     horas_contrato, activo`,
          [id, activo],
        )
        const row = result.rows[0]
        if (!row) throw notFound('Employee not found')
        return row
      } catch (error) {
        if (error instanceof AppError) throw error
        throw persistenceError(error)
      }
    },
  }
}
