import type { Db } from '../pool.js'
import { conflict } from '../../../http/errors/app-error.js'
import type { AuditPageQuery, AuditSubmit } from '../../../http/schemas/audits.js'
import {
  auditOne as one,
  auditPayloadHash as hash,
  auditTx as tx,
  beginAuditIdempotency as beginIdempotency,
  completeAuditIdempotency as completeIdempotency,
  siteJoin,
  siteJson,
} from './audits-shared.js'

export function createAuditsExecutionMethods(db: Db) {
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

  return {
    listAudits,
    auditDetail,
    submit,
    catalogs,
  }
}
