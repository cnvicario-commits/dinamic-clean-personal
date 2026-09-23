import type { Db } from './pool.js'
import { AppError, conflict, notFound } from '../../http/errors/app-error.js'
import type {
  AssignmentListItem,
  AssignmentsResponse,
  CreateAssignmentBody,
  ListAssignmentsQuery,
} from '../../http/schemas/assignments.js'

function persistenceError(error: unknown): AppError {
  const code = (error as { code?: unknown })?.code
  const constraint = (error as { constraint?: unknown })?.constraint
  if (code === '23503' && constraint === 'asignaciones_empleado_id_fkey') {
    return notFound('Employee not found')
  }
  if (code === '23503' && constraint === 'asignaciones_cliente_id_fkey') {
    return notFound('Client not found')
  }
  return new AppError(502, 'assignment_persistence_failed', 'Assignment persistence failed')
}

export type AssignmentsRepository = ReturnType<typeof createAssignmentsRepository>

export function createAssignmentsRepository(db: Db) {
  return {
    async list(input: ListAssignmentsQuery): Promise<AssignmentsResponse> {
      const offset = (input.page - 1) * input.pageSize
      const params: unknown[] = []
      const where: string[] = []
      if (input.active !== undefined) {
        where.push(input.active ? 'a.fecha_hasta is null' : 'a.fecha_hasta is not null')
      }
      const whereSql = where.length ? `where ${where.join(' and ')}` : ''
      const count = await db.query<{ count: string }>(
        `select count(*)::text as count from public.asignaciones a ${whereSql}`,
        params,
      )
      const result = await db.query<AssignmentListItem>(
        `select a.id, a.empleado_id, e.nombre_apellido as empleado_nombre,
                a.cliente_id, c.nombre as cliente_nombre,
                a.fecha_desde::text, a.fecha_hasta::text
         from public.asignaciones a
         join public.empleados e on e.id = a.empleado_id
         join public.clientes c on c.id = a.cliente_id
         ${whereSql}
         order by a.fecha_desde desc, a.id desc
         limit $1 offset $2`,
        [input.pageSize, offset],
      )
      return {
        items: result.rows,
        page: input.page,
        pageSize: input.pageSize,
        total: Number.parseInt(count.rows[0]?.count ?? '0', 10),
      }
    },

    async create(input: CreateAssignmentBody): Promise<AssignmentListItem> {
      try {
        const result = await db.query<AssignmentListItem>(
          `with inserted as (
             insert into public.asignaciones (empleado_id, cliente_id, fecha_desde)
             values ($1, $2, $3)
             returning id, empleado_id, cliente_id, fecha_desde, fecha_hasta
           )
           select i.id, i.empleado_id, e.nombre_apellido as empleado_nombre,
                  i.cliente_id, c.nombre as cliente_nombre,
                  i.fecha_desde::text, i.fecha_hasta::text
           from inserted i
           join public.empleados e on e.id = i.empleado_id
           join public.clientes c on c.id = i.cliente_id`,
          [input.empleadoId, input.clienteId, input.fechaDesde],
        )
        const row = result.rows[0]
        if (!row) throw new AppError(502, 'assignment_create_empty', 'Assignment persistence failed')
        return row
      } catch (error) {
        if (error instanceof AppError) throw error
        throw persistenceError(error)
      }
    },

    async close(id: string): Promise<AssignmentListItem> {
      const result = await db.query<AssignmentListItem & { outcome: 'closed' | 'already_closed' }>(
        `with updated as (
           update public.asignaciones
           set fecha_hasta = current_date
           where id = $1 and fecha_hasta is null
           returning id, empleado_id, cliente_id, fecha_desde, fecha_hasta
         ), selected as (
           select u.*, 'closed'::text as outcome from updated u
           union all
           select a.*, 'already_closed'::text as outcome
           from public.asignaciones a
           where a.id = $1 and not exists (select 1 from updated)
         )
         select s.id, s.empleado_id, e.nombre_apellido as empleado_nombre,
                s.cliente_id, c.nombre as cliente_nombre,
                s.fecha_desde::text, s.fecha_hasta::text, s.outcome
         from selected s
         join public.empleados e on e.id = s.empleado_id
         join public.clientes c on c.id = s.cliente_id`,
        [id],
      )
      const row = result.rows[0]
      if (!row) throw notFound('Assignment not found')
      if (row.outcome === 'already_closed') {
        throw conflict('Assignment is already closed', { fechaHasta: row.fecha_hasta })
      }
      const { outcome: _outcome, ...assignment } = row
      return assignment
    },
  }
}
