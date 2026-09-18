import type { Db } from '../../infrastructure/db/pool.js'
import { badRequest } from '../../http/errors/app-error.js'
import {
  listEmployeesQuerySchema,
  type EmployeesResponse,
  type EmployeeListItem,
  type ListEmployeesQuery,
} from '../../http/schemas/employees.js'

type EmployeeRow = {
  id: string
  nombre_apellido: string
  cuil: string
  fecha_ingreso: string | null
  horas_contrato: number
  activo: boolean
}

type AssignmentRow = {
  empleado_id: string
  fecha_desde: string
  fecha_hasta: string | null
  cliente_id: string | null
  cliente_nombre: string | null
}

export type ListEmployeesInput = ListEmployeesQuery

export function parseListEmployeesQuery(query: Record<string, unknown>): ListEmployeesInput {
  const parsed = listEmployeesQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw badRequest('Invalid query parameters', parsed.error.flatten())
  }
  const data = parsed.data
  const input: ListEmployeesInput = {
    page: data.page,
    pageSize: data.pageSize,
  }
  if (data.activo !== undefined) {
    input.activo = data.activo
  }
  return input
}

export async function listEmployees(db: Db, input: ListEmployeesInput): Promise<EmployeesResponse> {
  const offset = (input.page - 1) * input.pageSize
  const params: unknown[] = []
  const where: string[] = []

  if (input.activo !== undefined) {
    params.push(input.activo)
    where.push(`activo = $${params.length}`)
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : ''

  const countResult = await db.query<{ count: string }>(
    `select count(*)::text as count from public.empleados ${whereSql}`,
    params,
  )
  const total = Number.parseInt(countResult.rows[0]?.count ?? '0', 10)

  const listParams = [...params, input.pageSize, offset]
  const limitIdx = listParams.length - 1
  const offsetIdx = listParams.length

  const employees = await db.query<EmployeeRow>(
    `select id, nombre_apellido, cuil, fecha_ingreso::text, horas_contrato, activo
     from public.empleados
     ${whereSql}
     order by nombre_apellido asc
     limit $${limitIdx} offset $${offsetIdx}`,
    listParams,
  )

  const ids = employees.rows.map((e) => e.id)
  const assignmentsByEmployee = new Map<string, EmployeeListItem['asignaciones']>()

  if (ids.length > 0) {
    const asg = await db.query<AssignmentRow>(
      `select a.empleado_id,
              a.fecha_desde::text as fecha_desde,
              a.fecha_hasta::text as fecha_hasta,
              c.id as cliente_id,
              c.nombre as cliente_nombre
       from public.asignaciones a
       left join public.clientes c on c.id = a.cliente_id
       where a.empleado_id = any($1::uuid[])`,
      [ids],
    )
    for (const row of asg.rows) {
      const list = assignmentsByEmployee.get(row.empleado_id) ?? []
      list.push({
        fecha_desde: row.fecha_desde,
        fecha_hasta: row.fecha_hasta,
        clientes:
          row.cliente_id && row.cliente_nombre
            ? { id: row.cliente_id, nombre: row.cliente_nombre }
            : null,
      })
      assignmentsByEmployee.set(row.empleado_id, list)
    }
  }

  const items: EmployeeListItem[] = employees.rows.map((e) => ({
    id: e.id,
    nombre_apellido: e.nombre_apellido,
    cuil: e.cuil,
    fecha_ingreso: e.fecha_ingreso,
    horas_contrato: e.horas_contrato,
    activo: e.activo,
    asignaciones: assignmentsByEmployee.get(e.id) ?? [],
  }))

  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total,
  }
}
