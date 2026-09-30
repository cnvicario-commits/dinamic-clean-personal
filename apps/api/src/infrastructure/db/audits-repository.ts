import crypto from 'node:crypto'
import type pg from 'pg'
import type { Db } from './pool.js'
import { conflict, notFound } from '../../http/errors/app-error.js'
import type {
  ActionCreate,
  ActionListQuery,
  ActionUpdate,
  AuditListQuery,
  AuditPageQuery,
  AuditSubmit,
  ChecklistCopy,
  ChecklistCreate,
  ChecklistUpdate,
  DashboardQuery,
  PlanningBody,
  PlanningUpdate,
} from '../../http/schemas/audits.js'

type Client = pg.PoolClient

const tx = async <T>(db: Db, run: (c: Client) => Promise<T>): Promise<T> => {
  const c = await db.pool.connect()
  try {
    await c.query('begin')
    const result = await run(c)
    await c.query('commit')
    return result
  } catch (error) {
    await c.query('rollback')
    throw error
  } finally {
    c.release()
  }
}

const one = <T>(rows: T[], message: string): T => {
  if (!rows[0]) throw notFound(message)
  return rows[0]
}

/** Normalize pg Date / HTTP ISO strings so optimistic concurrency compares the same instant. */
const concurrencyToken = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    return value
  }
  throw conflict('Missing concurrency token')
}

const assertUnchanged = (current: unknown, expected: unknown, message: string) => {
  if (concurrencyToken(current) !== concurrencyToken(expected)) throw conflict(message)
}

const hash = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

const siteJoin = `
  join public.cliente_domicilios d on d.id = a.alias_id
  left join public.clientes cl on cl.id = d.cliente_id
  left join public.perfiles s on s.id = a.supervisor_id
`

const siteJson = `
  jsonb_build_object(
    'alias', d.alias,
    'direccion', d.direccion,
    'clientes', case when cl.id is null then null else jsonb_build_object('nombre', cl.nombre) end
  ) as cliente_domicilios,
  case when s.id is null then null else jsonb_build_object('nombre_completo', s.nombre_completo) end as perfiles
`

const auditDateFilter = (desde: string | undefined, hasta: string | undefined, params: unknown[]) => {
  const clauses: string[] = []
  if (desde) {
    params.push(desde)
    clauses.push(`a.fecha_realizada >= $${params.length}`)
  }
  if (hasta) {
    params.push(hasta)
    clauses.push(`a.fecha_realizada <= $${params.length}`)
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : ''
}

async function beginIdempotency(
  c: Client,
  actor: string,
  operation: 'audit_submit' | 'audit_checklist_copy',
  key: string,
  payloadHash: string,
) {
  await c.query(
    `insert into public.audits_operation_idempotency
      (actor_id, operation, idempotency_key, payload_hash, status)
     values ($1, $2, $3, $4, 'PROCESSING')
     on conflict do nothing`,
    [actor, operation, key, payloadHash],
  )

  const idem = one(
    (
      await c.query<{ payload_hash: string; status: string; response: unknown }>(
        `select payload_hash, status, response
         from public.audits_operation_idempotency
         where actor_id = $1 and operation = $2 and idempotency_key = $3
         for update`,
        [actor, operation, key],
      )
    ).rows,
    'Idempotency unavailable',
  )

  if (idem.payload_hash !== payloadHash) {
    throw conflict('Idempotency-Key was already used with a different payload')
  }

  if (idem.status === 'COMPLETED') {
    return { replayed: true as const, response: idem.response }
  }

  return { replayed: false as const, response: null }
}

async function completeIdempotency(
  c: Client,
  actor: string,
  operation: 'audit_submit' | 'audit_checklist_copy',
  key: string,
  response: unknown,
) {
  await c.query(
    `update public.audits_operation_idempotency
     set status = 'COMPLETED', response = $4, updated_at = now()
     where actor_id = $1 and operation = $2 and idempotency_key = $3`,
    [actor, operation, key, JSON.stringify(response)],
  )
}

export function createAuditsRepository(db: Db) {
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
    return one(rows.rows, 'Planning not found')
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
      .then(x => one(x.rows, 'Planning creation failed'))

  const updatePlanning = (id: string, v: PlanningUpdate) =>
    tx(db, async c => {
      const old = one(
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
      return one(
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
    tx(db, async c => {
      const old = one(
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
      return one(
        (
          await c.query(
            `update public.auditoria_planificaciones set estado = 'cancelada' where id = $1 returning *`,
            [id],
          )
        ).rows,
        'Planning not found',
      )
    })

  const listAudits = async (q: AuditPageQuery) => {
    const params: unknown[] = []
    const clauses: string[] = []
    const push = (value: unknown) => {
      params.push(value)
      return `$${params.length}`
    }

    if (q.supervisorId) clauses.push(`a.supervisor_id = ${push(q.supervisorId)}`)
    if (q.desde) clauses.push(`a.fecha_realizada >= ${push(q.desde)}`)
    if (q.hasta) clauses.push(`a.fecha_realizada <= ${push(q.hasta)}`)
    if (q.q) {
      const like = push(`%${q.q}%`)
      clauses.push(`(d.alias ilike ${like} or cl.nombre ilike ${like})`)
    }

    const where = clauses.length ? ` where ${clauses.join(' and ')}` : ''
    const total = await db.query<{ count: string }>(
      `select count(*)::text as count from public.auditorias a ${siteJoin}${where}`,
      params,
    )
    const rows = await db.query(
      `select a.id,
              a.fecha_realizada,
              a.evaluacion_general,
              a.supervisor_id,
              ${siteJson},
              (
                select count(*)::int
                from public.auditoria_respuestas r
                where r.auditoria_id = a.id and r.resultado = 'no_conforme'
              ) as no_conformidades
       from public.auditorias a
       ${siteJoin}
       ${where}
       order by a.fecha_realizada desc, a.id desc
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

  const auditDetail = async (id: string) => {
    const header = one(
      (
        await db.query(
          `select a.*,
                  jsonb_build_object(
                    'alias', d.alias,
                    'direccion', d.direccion,
                    'clientes', case when cl.id is null then null else jsonb_build_object('nombre', cl.nombre) end
                  ) as cliente_domicilios,
                  case when p.id is null then null
                       else jsonb_build_object('codigo_formulario', p.codigo_formulario, 'version', p.version)
                  end as auditoria_checklist_plantillas,
                  case when s.id is null then null else jsonb_build_object('nombre_completo', s.nombre_completo) end as perfiles
           from public.auditorias a
           join public.cliente_domicilios d on d.id = a.alias_id
           left join public.clientes cl on cl.id = d.cliente_id
           left join public.auditoria_checklist_plantillas p on p.id = a.plantilla_id
           left join public.perfiles s on s.id = a.supervisor_id
           where a.id = $1`,
          [id],
        )
      ).rows,
      'Audit not found',
    )

    const [respuestas, acciones] = await Promise.all([
      db.query(
        `select r.id, r.resultado, r.observaciones, r.item_id,
                case when i.id is null then null
                     else jsonb_build_object('orden', i.orden, 'texto', i.texto)
                end as auditoria_checklist_items
         from public.auditoria_respuestas r
         left join public.auditoria_checklist_items i on i.id = r.item_id
         where r.auditoria_id = $1
         order by i.orden nulls last, r.id`,
        [id],
      ),
      db.query(
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
        [id],
      ),
    ])

    return {
      ...header,
      respuestas: respuestas.rows,
      planes_accion: acciones.rows,
    }
  }

  const submit = async (v: AuditSubmit, actor: string, key: string) =>
    tx(db, async c => {
      const payloadHash = hash(v)
      const idem = await beginIdempotency(c, actor, 'audit_submit', key, payloadHash)
      if (idem.replayed) return { replayed: true, response: idem.response }

      const template = one(
        (
          await c.query<{ activa: boolean }>(
            'select activa from public.auditoria_checklist_plantillas where id = $1 for key share',
            [v.plantillaId],
          )
        ).rows,
        'Checklist template not found',
      )
      if (!template.activa) throw conflict('Checklist template is not active')

      if (v.planificacionId) {
        const plan = one(
          (
            await c.query<{ estado: string; alias_id: string; supervisor_id: string }>(
              'select estado, alias_id, supervisor_id from public.auditoria_planificaciones where id = $1 for update',
              [v.planificacionId],
            )
          ).rows,
          'Planning not found',
        )
        if (plan.estado !== 'planificada') {
          throw conflict('Planning is not available for audit submission')
        }
        if (plan.alias_id !== v.aliasId || plan.supervisor_id !== v.supervisorId) {
          throw conflict('Audit does not match planning')
        }
      }

      const items = (
        await c.query<{ id: string }>(
          'select id from public.auditoria_checklist_items where plantilla_id = $1',
          [v.plantillaId],
        )
      ).rows

      if (
        items.length !== v.respuestas.length ||
        new Set(v.respuestas.map(x => x.itemId)).size !== items.length ||
        !v.respuestas.every(x => items.some(i => i.id === x.itemId))
      ) {
        throw conflict('Responses must match every checklist item exactly once')
      }

      const audit = one(
        (
          await c.query(
            `insert into public.auditorias
              (planificacion_id, alias_id, plantilla_id, fecha_realizada, supervisor_id,
               evaluacion_general, proxima_supervision_fecha, quejas_comentarios_cliente, otros)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             returning *`,
            [
              v.planificacionId,
              v.aliasId,
              v.plantillaId,
              v.fechaRealizada,
              v.supervisorId,
              v.evaluacionGeneral,
              v.proximaSupervisionFecha,
              v.quejasComentariosCliente,
              v.otros,
            ],
          )
        ).rows,
        'Audit creation failed',
      )

      await c.query(
        `insert into public.auditoria_respuestas (auditoria_id, item_id, resultado, observaciones)
         select $1, x.item_id, x.resultado, x.observaciones
         from jsonb_to_recordset($2::jsonb) as x(item_id uuid, resultado text, observaciones text)`,
        [
          (audit as { id: string }).id,
          JSON.stringify(
            v.respuestas.map(x => ({
              item_id: x.itemId,
              resultado: x.resultado,
              observaciones: x.observaciones,
            })),
          ),
        ],
      )

      if (v.planificacionId) {
        await c.query(
          `update public.auditoria_planificaciones set estado = 'realizada' where id = $1`,
          [v.planificacionId],
        )
      }

      await completeIdempotency(c, actor, 'audit_submit', key, audit)
      return { replayed: false, response: audit }
    })

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

  const listChecklists = async () => {
    const rows = await db.query(
      `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
       from public.auditoria_checklist_plantillas
       order by vigencia_desde desc, created_at desc, id`,
    )
    return rows.rows
  }

  const checklistDetail = async (id: string) => {
    const plantilla = one(
      (
        await db.query(
          `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
           from public.auditoria_checklist_plantillas
           where id = $1`,
          [id],
        )
      ).rows,
      'Checklist template not found',
    )
    const items = await db.query(
      `select id, plantilla_id, orden, texto, created_at
       from public.auditoria_checklist_items
       where plantilla_id = $1
       order by orden asc, id`,
      [id],
    )
    return { ...plantilla, items: items.rows }
  }

  const checklistActive = async () => {
    const plantilla = (
      await db.query(
        `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
         from public.auditoria_checklist_plantillas
         where activa = true
         limit 1`,
      )
    ).rows[0]
    if (!plantilla) throw notFound('No active checklist template')
    const items = await db.query(
      `select id, plantilla_id, orden, texto, created_at
       from public.auditoria_checklist_items
       where plantilla_id = $1
       order by orden asc, id`,
      [(plantilla as { id: string }).id],
    )
    return { ...plantilla, items: items.rows }
  }

  const checklistCreate = (v: ChecklistCreate) =>
    tx(db, async c => {
      const plantilla = one(
        (
          await c.query(
            `insert into public.auditoria_checklist_plantillas
              (codigo_formulario, version, vigencia_desde, activa)
             values ($1, $2, $3, false)
             returning *`,
            [v.codigoFormulario, v.version, v.vigenciaDesde],
          )
        ).rows,
        'Checklist creation failed',
      )
      await c.query(
        `insert into public.auditoria_checklist_items (plantilla_id, orden, texto)
         select $1, x.orden, x.texto
         from jsonb_to_recordset($2::jsonb) as x(orden int, texto text)`,
        [(plantilla as { id: string }).id, JSON.stringify(v.items)],
      )
      return plantilla
    })

  const checklistUpdate = (id: string, v: ChecklistUpdate) =>
    tx(db, async c => {
      const plantilla = one(
        (
          await c.query<{ updated_at: string | null }>(
            `select updated_at
             from public.auditoria_checklist_plantillas
             where id = $1
             for update`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )
      assertUnchanged(plantilla.updated_at, v.updatedAt, 'Checklist template was modified by another user')

      const used = await c.query<{ exists: boolean }>(
        `select exists(
           select 1 from public.auditorias where plantilla_id = $1
         ) as exists`,
        [id],
      )
      if (used.rows[0]?.exists) {
        throw conflict('Checklist template is historical and cannot be edited')
      }

      const existing = (
        await c.query<{ id: string }>(
          'select id from public.auditoria_checklist_items where plantilla_id = $1 for update',
          [id],
        )
      ).rows.map(row => row.id)

      const keepIds = v.items.filter(item => item.id).map(item => item.id!)
      for (const itemId of keepIds) {
        if (!existing.includes(itemId)) {
          throw conflict('Checklist item does not belong to this template')
        }
      }

      const removeIds = existing.filter(itemId => !keepIds.includes(itemId))
      if (removeIds.length) {
        await c.query(
          'delete from public.auditoria_checklist_items where plantilla_id = $1 and id = any($2::uuid[])',
          [id, removeIds],
        )
      }

      for (const item of v.items) {
        if (item.id) {
          await c.query(
            `update public.auditoria_checklist_items
             set orden = $2, texto = $3
             where id = $1 and plantilla_id = $4`,
            [item.id, item.orden, item.texto, id],
          )
        } else {
          await c.query(
            `insert into public.auditoria_checklist_items (plantilla_id, orden, texto)
             values ($1, $2, $3)`,
            [id, item.orden, item.texto],
          )
        }
      }

      // Touch plantilla so updated_at advances via trigger even if only items changed.
      await c.query(
        `update public.auditoria_checklist_plantillas
         set version = version
         where id = $1`,
        [id],
      )

      return checklistDetailWithClient(c, id)
    })

  const checklistDetailWithClient = async (c: Client, id: string) => {
    const plantilla = one(
      (
        await c.query(
          `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
           from public.auditoria_checklist_plantillas
           where id = $1`,
          [id],
        )
      ).rows,
      'Checklist template not found',
    )
    const items = await c.query(
      `select id, plantilla_id, orden, texto, created_at
       from public.auditoria_checklist_items
       where plantilla_id = $1
       order by orden asc, id`,
      [id],
    )
    return { ...plantilla, items: items.rows }
  }

  const checklistCopy = (id: string, v: ChecklistCopy, actor: string, key: string) =>
    tx(db, async c => {
      const payloadHash = hash({ sourceId: id, ...v })
      const idem = await beginIdempotency(c, actor, 'audit_checklist_copy', key, payloadHash)
      if (idem.replayed) return { replayed: true, response: idem.response }

      const source = one(
        (
          await c.query<{ codigo_formulario: string }>(
            `select codigo_formulario
             from public.auditoria_checklist_plantillas
             where id = $1
             for update`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )

      const plantilla = one(
        (
          await c.query(
            `insert into public.auditoria_checklist_plantillas
              (codigo_formulario, version, vigencia_desde, activa)
             values ($1, $2, $3, false)
             returning *`,
            [source.codigo_formulario, v.version, v.vigenciaDesde],
          )
        ).rows,
        'Checklist copy failed',
      )

      await c.query(
        `insert into public.auditoria_checklist_items (plantilla_id, orden, texto)
         select $1, orden, texto
         from public.auditoria_checklist_items
         where plantilla_id = $2
         order by orden, id`,
        [(plantilla as { id: string }).id, id],
      )

      const detail = await checklistDetailWithClient(c, (plantilla as { id: string }).id)
      await completeIdempotency(c, actor, 'audit_checklist_copy', key, detail)
      return { replayed: false, response: detail }
    })

  const checklistActivate = (id: string, updatedAt: string) =>
    tx(db, async c => {
      const old = one(
        (
          await c.query<{ updated_at: string | null }>(
            `select updated_at
             from public.auditoria_checklist_plantillas
             where id = $1
             for update`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )
      assertUnchanged(old.updated_at, updatedAt, 'Checklist template was modified by another user')

      // Serialize against concurrent activations and clear the previous active
      // row before setting this one, so the partial UNIQUE index does not race
      // with the AFTER trigger.
      await c.query(
        `select id
         from public.auditoria_checklist_plantillas
         where activa
         for update`,
      )
      await c.query(
        `update public.auditoria_checklist_plantillas
         set activa = false
         where activa and id <> $1`,
        [id],
      )

      return one(
        (
          await c.query(
            `update public.auditoria_checklist_plantillas
             set activa = true
             where id = $1
             returning *`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )
    })

  const catalogs = async () => {
    const [clientes, domicilios, supervisores] = await Promise.all([
      db.query(
        `select id, nombre
         from public.clientes
         where activo = true
         order by nombre`,
      ),
      db.query(
        `select id, cliente_id, alias, direccion, activo
         from public.cliente_domicilios
         order by alias`,
      ),
      db.query(
        `select id, nombre_completo
         from public.perfiles
         order by nombre_completo`,
      ),
    ])
    return {
      clientes: clientes.rows,
      domicilios: domicilios.rows,
      supervisores: supervisores.rows,
    }
  }

  const dashboard = async (q: DashboardQuery) => {
    const dateParams: unknown[] = []
    const dateWhere = auditDateFilter(q.desde, q.hasta, dateParams)

    const [
      totals,
      conformidadGeneral,
      conformidadPorItem,
      evolucion,
      rankingSitiosCantidad,
      rankingSitiosCumplimiento,
      auditoriasPeorCumplimiento,
      planificacionEstados,
      accionEstados,
      planesVencidos,
    ] = await Promise.all([
      db.query<{
        sitios_auditados: string
        conformes: string
        no_conformes: string
        no_aplica: string
        quejas_registradas: string
      }>(
        `select
           (select count(*)::text from public.auditorias a${dateWhere}) as sitios_auditados,
           (select count(*)::text
            from public.auditoria_respuestas r
            join public.auditorias a on a.id = r.auditoria_id
            ${dateWhere ? `${dateWhere} and` : ' where'} r.resultado = 'conforme') as conformes,
           (select count(*)::text
            from public.auditoria_respuestas r
            join public.auditorias a on a.id = r.auditoria_id
            ${dateWhere ? `${dateWhere} and` : ' where'} r.resultado = 'no_conforme') as no_conformes,
           (select count(*)::text
            from public.auditoria_respuestas r
            join public.auditorias a on a.id = r.auditoria_id
            ${dateWhere ? `${dateWhere} and` : ' where'} r.resultado = 'no_aplica') as no_aplica,
           (select count(*)::text
            from public.auditorias a
            ${dateWhere ? `${dateWhere} and` : ' where'}
              a.quejas_comentarios_cliente is not null
              and length(trim(a.quejas_comentarios_cliente)) > 0) as quejas_registradas`,
        dateParams,
      ),
      db.query<{ conformidad_general: string | null }>(
        `with audit_stats as (
           select r.auditoria_id,
                  count(*) filter (where r.resultado = 'conforme')::float as conformes,
                  count(*) filter (where r.resultado = 'no_conforme')::float as no_conformes
           from public.auditoria_respuestas r
           join public.auditorias a on a.id = r.auditoria_id
           ${dateWhere}
           group by r.auditoria_id
         ),
         evaluated as (
           select conformes / nullif(conformes + no_conformes, 0) as pct
           from audit_stats
           where conformes + no_conformes > 0
         )
         select avg(pct)::text as conformidad_general from evaluated`,
        dateParams,
      ),
      db.query(
        `select i.texto,
                count(*) filter (where r.resultado = 'conforme')::int as conformes,
                count(*) filter (where r.resultado = 'no_conforme')::int as no_conformes,
                count(*) filter (where r.resultado in ('conforme', 'no_conforme'))::int as total
         from public.auditoria_respuestas r
         join public.auditorias a on a.id = r.auditoria_id
         join public.auditoria_checklist_items i on i.id = r.item_id
         ${dateWhere}
         group by i.texto
         having count(*) filter (where r.resultado in ('conforme', 'no_conforme')) > 0
         order by
           (count(*) filter (where r.resultado = 'conforme'))::float
           / nullif(count(*) filter (where r.resultado in ('conforme', 'no_conforme')), 0) asc,
           i.texto`,
        dateParams,
      ),
      db.query(
        `with months as (
           select to_char(a.fecha_realizada, 'YYYY-MM') as mes,
                  count(distinct a.id)::int as cantidad_auditorias
           from public.auditorias a
           ${dateWhere}
           group by 1
         ),
         answers as (
           select to_char(a.fecha_realizada, 'YYYY-MM') as mes,
                  count(*) filter (where r.resultado = 'conforme')::int as conformes,
                  count(*) filter (where r.resultado = 'no_conforme')::int as no_conformes
           from public.auditoria_respuestas r
           join public.auditorias a on a.id = r.auditoria_id
           ${dateWhere}
           group by 1
         )
         select coalesce(m.mes, a.mes) as mes,
                coalesce(m.cantidad_auditorias, 0) as cantidad_auditorias,
                coalesce(a.conformes, 0) as conformes,
                coalesce(a.no_conformes, 0) as no_conformes,
                coalesce(a.conformes, 0) + coalesce(a.no_conformes, 0) as total
         from months m
         full outer join answers a on a.mes = m.mes
         order by 1`,
        dateParams,
      ),
      db.query(
        `select
           coalesce(cl.nombre, '-') || ' — ' || coalesce(d.alias, '-') as nombre,
           count(*)::int as cantidad
         from public.auditoria_respuestas r
         join public.auditorias a on a.id = r.auditoria_id
         join public.cliente_domicilios d on d.id = a.alias_id
         left join public.clientes cl on cl.id = d.cliente_id
         ${dateWhere ? `${dateWhere} and` : ' where'} r.resultado = 'no_conforme'
         group by 1
         order by cantidad desc, nombre
         limit 10`,
        dateParams,
      ),
      db.query(
        `with audit_stats as (
           select r.auditoria_id,
                  count(*) filter (where r.resultado = 'conforme')::int as conformes,
                  count(*) filter (where r.resultado = 'no_conforme')::int as no_conformes
           from public.auditoria_respuestas r
           join public.auditorias a on a.id = r.auditoria_id
           ${dateWhere}
           group by r.auditoria_id
         ),
         by_site as (
           select coalesce(cl.nombre, '-') || ' — ' || coalesce(d.alias, '-') as nombre,
                  sum(s.conformes)::int as conformes,
                  sum(s.conformes + s.no_conformes)::int as total
           from audit_stats s
           join public.auditorias a on a.id = s.auditoria_id
           join public.cliente_domicilios d on d.id = a.alias_id
           left join public.clientes cl on cl.id = d.cliente_id
           where s.conformes + s.no_conformes > 0
           group by 1
         )
         select nombre, conformes, total,
                (conformes::float / nullif(total, 0)) as pct
         from by_site
         order by pct asc, nombre
         limit 10`,
        dateParams,
      ),
      db.query(
        `with audit_stats as (
           select r.auditoria_id,
                  count(*) filter (where r.resultado = 'conforme')::int as conformes,
                  count(*) filter (where r.resultado = 'no_conforme')::int as no_conformes
           from public.auditoria_respuestas r
           join public.auditorias a on a.id = r.auditoria_id
           ${dateWhere}
           group by r.auditoria_id
         )
         select a.id,
                a.fecha_realizada as fecha,
                coalesce(cl.nombre, '-') as cliente,
                coalesce(d.alias, '-') as sitio,
                coalesce(s.nombre_completo, '-') as supervisor,
                (st.conformes + st.no_conformes)::int as total,
                (st.conformes::float / nullif(st.conformes + st.no_conformes, 0)) as pct
         from audit_stats st
         join public.auditorias a on a.id = st.auditoria_id
         join public.cliente_domicilios d on d.id = a.alias_id
         left join public.clientes cl on cl.id = d.cliente_id
         left join public.perfiles s on s.id = a.supervisor_id
         where st.conformes + st.no_conformes > 0
         order by pct asc, a.fecha_realizada desc, a.id
         limit 10`,
        dateParams,
      ),
      db.query<{ estado: string; cantidad: string }>(
        `select estado, count(*)::text as cantidad
         from (
           select case
                    when estado = 'planificada' and fecha_propuesta < current_date then 'vencida'
                    else estado
                  end as estado
           from public.auditoria_planificaciones
         ) x
         group by estado`,
      ),
      db.query<{ estado: string; cantidad: string }>(
        `select estado, count(*)::text as cantidad
         from public.auditoria_plan_accion
         group by estado`,
      ),
      db.query<{ count: string }>(
        `select count(*)::text as count
         from public.auditoria_plan_accion
         where estado <> 'resuelto'
           and fecha_limite is not null
           and fecha_limite < current_date`,
      ),
    ])

    const t = totals.rows[0]
    const conformes = Number(t?.conformes ?? 0)
    const noConformes = Number(t?.no_conformes ?? 0)

    const planStates = ['planificada', 'vencida', 'realizada', 'cancelada'] as const
    const planMap = new Map(planificacionEstados.rows.map(r => [r.estado, Number(r.cantidad)]))
    const actionStates = ['pendiente', 'en_curso', 'resuelto'] as const
    const actionMap = new Map(accionEstados.rows.map(r => [r.estado, Number(r.cantidad)]))

    return {
      sitios_auditados: Number(t?.sitios_auditados ?? 0),
      conformes,
      no_conformes: noConformes,
      no_aplica: Number(t?.no_aplica ?? 0),
      evaluables: conformes + noConformes,
      conformidad_general: conformidadGeneral.rows[0]?.conformidad_general
        ? Number(conformidadGeneral.rows[0].conformidad_general)
        : null,
      quejas_registradas: Number(t?.quejas_registradas ?? 0),
      planes_vencidos: Number(planesVencidos.rows[0]?.count ?? 0),
      por_estado_planificacion: planStates.map(estado => ({
        estado,
        cantidad: planMap.get(estado) ?? 0,
      })),
      por_estado_plan_accion: actionStates.map(estado => ({
        estado,
        cantidad: actionMap.get(estado) ?? 0,
      })),
      conformidad_por_item: conformidadPorItem.rows,
      evolucion: evolucion.rows,
      ranking_sitios_cantidad: rankingSitiosCantidad.rows,
      ranking_sitios_cumplimiento: rankingSitiosCumplimiento.rows,
      auditorias_peor_cumplimiento: auditoriasPeorCumplimiento.rows,
    }
  }

  return {
    plans,
    planningById,
    createPlanning,
    updatePlanning,
    cancelPlanning,
    listAudits,
    auditDetail,
    dashboard,
    catalogs,
    submit,
    listActionsForAudit,
    listActions,
    createAction,
    updateAction,
    listChecklists,
    checklistDetail,
    checklistActive,
    checklistCreate,
    checklistUpdate,
    checklistCopy,
    checklistActivate,
  }
}
