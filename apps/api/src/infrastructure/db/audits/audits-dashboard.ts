import type { Db } from '../pool.js'
import type { DashboardQuery } from '../../../http/schemas/audits.js'
import { auditDateFilter } from './audits-shared.js'

export function createAuditsDashboardMethods(db: Db) {
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
    dashboard,
  }
}
