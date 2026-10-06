import type { Db } from '../pool.js'
import { conflict } from '../../../http/errors/app-error.js'
import type { ActionCreate, ActionListQuery, ActionUpdate } from '../../../http/schemas/audits.js'
import { assertUnchanged, auditOne as one, auditTx as tx } from './audits-shared.js'

export function createAuditsActionsMethods(db: Db) {
  const listActionsForAudit = async (auditId: string) => {
    one(
      (await db.query('select id from public.auditorias where id = $1', [auditId])).rows,
      'Audit not found',
    )
    const rows = await db.query(
      `select pa.*,
              case when pr.id is null then null else jsonb_build_object('nombre_completo', pr.nombre_completo) end as perfiles,
              case when r.id is null then null
                   else jsonb_build_object(
                     'auditoria_checklist_items',
                     case when i.id is null then null else jsonb_build_object('texto', i.texto) end
                   )
              end as auditoria_respuestas
       from public.auditoria_plan_accion pa
       left join public.perfiles pr on pr.id = pa.responsable_id
       left join public.auditoria_respuestas r on r.id = pa.respuesta_id
       left join public.auditoria_checklist_items i on i.id = r.item_id
       where pa.auditoria_id = $1
       order by pa.created_at asc, pa.id`,
      [auditId],
    )
    return rows.rows
  }

  const listActions = async (q: ActionListQuery) => {
    const params: unknown[] = []
    const clauses: string[] = []
    const push = (value: unknown) => {
      params.push(value)
      return `$${params.length}`
    }

    if (q.estado) clauses.push(`pa.estado = ${push(q.estado)}`)
    if (q.responsableId) clauses.push(`pa.responsable_id = ${push(q.responsableId)}`)
    if (q.vencidos === true) {
      clauses.push(`pa.estado <> 'resuelto' and pa.fecha_limite is not null and pa.fecha_limite < current_date`)
    }
    if (q.q) {
      const like = push(`%${q.q}%`)
      clauses.push(
        `(pa.descripcion ilike ${like}
          or d.alias ilike ${like}
          or cl.nombre ilike ${like})`,
      )
    }

    const where = clauses.length ? ` where ${clauses.join(' and ')}` : ''
    const from = `
      from public.auditoria_plan_accion pa
      join public.auditorias a on a.id = pa.auditoria_id
      join public.cliente_domicilios d on d.id = a.alias_id
      left join public.clientes cl on cl.id = d.cliente_id
      left join public.perfiles pr on pr.id = pa.responsable_id
      left join public.auditoria_respuestas r on r.id = pa.respuesta_id
      left join public.auditoria_checklist_items i on i.id = r.item_id
    `

    const total = await db.query<{ count: string }>(
      `select count(*)::text as count ${from}${where}`,
      params,
    )
    const rows = await db.query(
      `select pa.*,
              case when pr.id is null then null else jsonb_build_object('nombre_completo', pr.nombre_completo) end as perfiles,
              jsonb_build_object(
                'fecha_realizada', a.fecha_realizada,
                'cliente_domicilios', jsonb_build_object(
                  'alias', d.alias,
                  'clientes', case when cl.id is null then null else jsonb_build_object('nombre', cl.nombre) end
                )
              ) as auditorias,
              case when r.id is null then null
                   else jsonb_build_object(
                     'auditoria_checklist_items',
                     case when i.id is null then null else jsonb_build_object('texto', i.texto) end
                   )
              end as auditoria_respuestas
       ${from}
       ${where}
       order by pa.fecha_limite nulls last, pa.id
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

  const createAction = (auditId: string, v: ActionCreate) =>
    tx(db, async c => {
      one(
        (await c.query('select id from public.auditorias where id = $1 for key share', [auditId])).rows,
        'Audit not found',
      )
      if (v.respuestaId) {
        const answer = one(
          (
            await c.query<{ auditoria_id: string }>(
              'select auditoria_id from public.auditoria_respuestas where id = $1 for key share',
              [v.respuestaId],
            )
          ).rows,
          'Response not found',
        )
        if (answer.auditoria_id !== auditId) {
          throw conflict('Response belongs to another audit')
        }
      }
      return one(
        (
          await c.query(
            `insert into public.auditoria_plan_accion
              (auditoria_id, respuesta_id, descripcion, responsable_id, fecha_limite)
             values ($1, $2, $3, $4, $5)
             returning *`,
            [auditId, v.respuestaId, v.descripcion, v.responsableId, v.fechaLimite],
          )
        ).rows,
        'Action creation failed',
      )
    })

  const updateAction = (id: string, v: ActionUpdate) =>
    tx(db, async c => {
      const old = one(
        (
          await c.query<{ updated_at: string | null }>(
            'select updated_at from public.auditoria_plan_accion where id = $1 for update',
            [id],
          )
        ).rows,
        'Action not found',
      )
      assertUnchanged(old.updated_at, v.updatedAt, 'Action was modified by another user')

      const fields = [
        'estado = $2',
        `fecha_resolucion = case when $2 = 'resuelto' then current_date else null end`,
      ]
      const values: unknown[] = [id, v.estado]

      if (v.descripcion !== undefined) {
        values.push(v.descripcion)
        fields.push(`descripcion = $${values.length}`)
      }
      if (v.responsableId !== undefined) {
        values.push(v.responsableId)
        fields.push(`responsable_id = $${values.length}`)
      }
      if (v.fechaLimite !== undefined) {
        values.push(v.fechaLimite)
        fields.push(`fecha_limite = $${values.length}`)
      }

      return one(
        (
          await c.query(
            `update public.auditoria_plan_accion set ${fields.join(', ')} where id = $1 returning *`,
            values,
          )
        ).rows,
        'Action not found',
      )
    })

  return {
    listActionsForAudit,
    listActions,
    createAction,
    updateAction,
  }
}
