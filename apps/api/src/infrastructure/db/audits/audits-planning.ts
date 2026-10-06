import type { Db } from '../pool.js'
import { conflict } from '../../../http/errors/app-error.js'
import type { AuditListQuery, PlanningBody, PlanningUpdate } from '../../../http/schemas/audits.js'
import { assertUnchanged, auditOne, auditTx } from './audits-shared.js'

export function createAuditsPlanningMethods(db: Db) {
  const plans = async (q: AuditListQuery) => {
    const params: unknown[] = []
    const clauses: string[] = []
    const push = (value: unknown) => {
      params.push(value)
      return `$${params.length}`
    }

    // `vencida` is derived (planificada + fecha_propuesta < current_date), never persisted.
    if (q.estado === 'vencida') {
      clauses.push(`p.estado = 'planificada' and p.fecha_propuesta < current_date`)
    } else if (q.estado === 'planificada') {
      clauses.push(`p.estado = 'planificada' and p.fecha_propuesta >= current_date`)
    } else if (q.estado) {
      clauses.push(`p.estado = ${push(q.estado)}`)
    }
    if (q.supervisorId) clauses.push(`p.supervisor_id = ${push(q.supervisorId)}`)
    if (q.desde) clauses.push(`p.fecha_propuesta >= ${push(q.desde)}`)
    if (q.hasta) clauses.push(`p.fecha_propuesta <= ${push(q.hasta)}`)

    const where = clauses.length ? ` where ${clauses.join(' and ')}` : ''
    const total = await db.query<{ count: string }>(
      `select count(*)::text as count from public.auditoria_planificaciones p${where}`,
      params,
    )
    const rows = await db.query(
      `select p.*,
              jsonb_build_object(
                'alias', d.alias,
                'direccion', d.direccion,
                'clientes', case when cl.id is null then null else jsonb_build_object('nombre', cl.nombre) end
              ) as cliente_domicilios,
              case when s.id is null then null else jsonb_build_object('nombre_completo', s.nombre_completo) end as perfiles
       from public.auditoria_planificaciones p
       join public.cliente_domicilios d on d.id = p.alias_id
       left join public.clientes cl on cl.id = d.cliente_id
       left join public.perfiles s on s.id = p.supervisor_id
       ${where}
       order by p.fecha_propuesta asc, p.id
       offset $${params.length + 1} limit $${params.length + 2}`,
      [...params, (q.page - 1) * q.pageSize, q.pageSize],
    )

    return {
      items: rows.rows,
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total.rows[0]?.count ?? 0),
    }
  }

  const planningById = async (id: string) => {
    const rows = await db.query(
      `select p.*,
              jsonb_build_object(
                'cliente_id', d.cliente_id,
                'clientes', case when cl.id is null then null else jsonb_build_object('id', cl.id, 'nombre', cl.nombre) end
              ) as cliente_domicilios
       from public.auditoria_planificaciones p
       join public.cliente_domicilios d on d.id = p.alias_id
       left join public.clientes cl on cl.id = d.cliente_id
       where p.id = $1`,
      [id],
    )
    return auditOne(rows.rows, 'Planning not found')
  }

  const createPlanning = (v: PlanningBody) =>
    db
      .query(
        `insert into public.auditoria_planificaciones
          (alias_id, fecha_propuesta, horario_desde, horario_hasta, supervisor_id, observaciones)
         values ($1, $2, $3, $4, $5, $6)
         returning *`,
        [v.aliasId, v.fechaPropuesta, v.horarioDesde, v.horarioHasta, v.supervisorId, v.observaciones],
      )
      .then((x) => auditOne(x.rows, 'Planning creation failed'))

  const updatePlanning = (id: string, v: PlanningUpdate) =>
    auditTx(db, async (c) => {
      const old = auditOne(
        (
          await c.query<{ updated_at: string | null; estado: string }>(
            'select updated_at, estado from public.auditoria_planificaciones where id = $1 for update',
            [id],
          )
        ).rows,
        'Planning not found',
      )
      assertUnchanged(old.updated_at, v.updatedAt, 'Planning was modified by another user')
      if (old.estado !== 'planificada') throw conflict('Only planned audits may be edited')
      return auditOne(
        (
          await c.query(
            `update public.auditoria_planificaciones
             set alias_id = $2,
                 fecha_propuesta = $3,
                 horario_desde = $4,
                 horario_hasta = $5,
                 supervisor_id = $6,
                 observaciones = $7
             where id = $1
             returning *`,
            [id, v.aliasId, v.fechaPropuesta, v.horarioDesde, v.horarioHasta, v.supervisorId, v.observaciones],
          )
        ).rows,
        'Planning not found',
      )
    })

  const cancelPlanning = (id: string, updatedAt: string) =>
    auditTx(db, async (c) => {
      const old = auditOne(
        (
          await c.query<{ updated_at: string | null; estado: string }>(
            'select updated_at, estado from public.auditoria_planificaciones where id = $1 for update',
            [id],
          )
        ).rows,
        'Planning not found',
      )
      assertUnchanged(old.updated_at, updatedAt, 'Planning was modified by another user')
      if (old.estado !== 'planificada') throw conflict('Only planned audits may be cancelled')
      return auditOne(
        (
          await c.query(
            `update public.auditoria_planificaciones set estado = 'cancelada' where id = $1 returning *`,
            [id],
          )
        ).rows,
        'Planning not found',
      )
    })

  return { plans, planningById, createPlanning, updatePlanning, cancelPlanning }
}
