import type { Db } from "../pool.js";
import type { CrmListQuery } from "../../../http/schemas/crm.js";

export function createCrmReadModelMethods(
  db: Db,
  list: (q: CrmListQuery) => Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
  }>,
) {
  const dashboard = async (actor: string, q: CrmListQuery) => {
    const opportunities = await list(q);
    const ids = opportunities.items.map((item) => String((item as { id: string }).id));
    const [seguimientos, vistas, novedades] = await Promise.all([
      ids.length
        ? db.query(
            `select s.oportunidad_id,s.usuario_id,s.usuario_nombre_libre,s.tipo_contacto,s.nota,s.created_at,
case when p.id is null then null else jsonb_build_object('nombre_completo',p.nombre_completo) end perfiles
from public.crm_seguimientos s left join public.perfiles p on p.id=s.usuario_id
where s.oportunidad_id=any($1::uuid[])`,
            [ids],
          )
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      ids.length
        ? db.query(
            "select oportunidad_id,last_viewed_at from public.crm_vistas where usuario_id=$1 and oportunidad_id=any($2::uuid[])",
            [actor, ids],
          )
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      db.query(
        `with unread as (
select s.oportunidad_id,s.usuario_id,s.usuario_nombre_libre,s.nota,s.created_at,
case when pr.id is null then null else jsonb_build_object('nombre_completo',pr.nombre_completo) end perfiles
from public.crm_seguimientos s join public.crm_oportunidades o on o.id=s.oportunidad_id
join public.crm_prospectos cp on cp.id=o.prospecto_id
left join public.crm_vistas v on v.oportunidad_id=s.oportunidad_id and v.usuario_id=$1
left join public.perfiles pr on pr.id=s.usuario_id
where v.last_viewed_at is null or s.created_at>v.last_viewed_at
), ranked as (
select *,count(*) over(partition by oportunidad_id)::int cantidad,
row_number() over(partition by oportunidad_id order by created_at desc) rn from unread
)
select r.oportunidad_id "oportunidadId",cp.nombre "prospectoNombre",r.cantidad,r.usuario_nombre_libre "usuarioNombreLibre",
r.nota,r.created_at "creadoEn",r.perfiles
from ranked r join public.crm_oportunidades o on o.id=r.oportunidad_id
join public.crm_prospectos cp on cp.id=o.prospecto_id where r.rn=1 order by r.created_at desc`,
        [actor],
      ),
    ]);
    return {
      ...opportunities,
      seguimientos: seguimientos.rows,
      vistas: vistas.rows,
      novedades: novedades.rows,
    };
  };
  const summary = async (q: CrmListQuery) => {
    const params: unknown[] = [];
    const clauses: string[] = [];
    const value = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (q.responsableId) clauses.push(`o.responsable_id=${value(q.responsableId)}`);
    if (q.desde) clauses.push(`o.fecha_ingreso>=${value(q.desde)}`);
    if (q.hasta) clauses.push(`o.fecha_ingreso<=${value(q.hasta)}`);
    const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
    const from = ` from public.crm_oportunidades o join public.crm_prospectos p on p.id=o.prospecto_id
left join public.crm_tipos_cliente tc on tc.id=p.tipo_cliente_id
left join public.crm_referidores r on r.id=p.referido_por_id`;
    const [totals, states, types, referrers] = await Promise.all([
      db.query<{
        cantidad: string;
        monto: string;
        monto_aceptado: string;
        aceptadas: string;
        rechazadas: string;
        comision_total: string;
        comision_liquidada: string;
      }>(
        `select count(*)::text cantidad,coalesce(sum(o.monto_estimado),0)::text monto,
coalesce(sum(o.monto_estimado) filter(where o.estado='aceptado'),0)::text monto_aceptado,
count(*) filter(where o.estado='aceptado')::text aceptadas,
count(*) filter(where o.estado='rechazado')::text rechazadas,
coalesce(sum(o.comision_monto) filter(where o.estado='aceptado'),0)::text comision_total,
coalesce(sum(o.comision_monto) filter(where o.estado='aceptado' and o.comision_liquidada),0)::text comision_liquidada${from}${where}`,
        params,
      ),
      db.query<{ estado: string; cantidad: string; monto: string }>(
        `select o.estado,count(*)::text cantidad,coalesce(sum(o.monto_estimado),0)::text monto${from}${where}
group by o.estado`,
        params,
      ),
      db.query<{ nombre: string; cantidad: string; monto: string }>(
        `select coalesce(tc.nombre,'Sin tipo de cliente') nombre,count(*)::text cantidad,
coalesce(sum(o.monto_estimado),0)::text monto${from}${where}
group by coalesce(tc.nombre,'Sin tipo de cliente') order by count(*) desc`,
        params,
      ),
      db.query<{ nombre: string; cantidad: string; monto: string }>(
        `select coalesce(r.nombre,'Sin referidor') nombre,count(*)::text cantidad,
coalesce(sum(o.monto_estimado),0)::text monto${from}${where}
group by coalesce(r.nombre,'Sin referidor') order by count(*) desc`,
        params,
      ),
    ]);
    const total = totals.rows[0] ?? {
      cantidad: "0",
      monto: "0",
      monto_aceptado: "0",
      aceptadas: "0",
      rechazadas: "0",
      comision_total: "0",
      comision_liquidada: "0",
    };
    const accepted = Number(total.aceptadas),
      rejected = Number(total.rechazadas),
      commission = Number(total.comision_total),
      paid = Number(total.comision_liquidada);
    return {
      totalCantidad: Number(total.cantidad),
      totalMonto: Number(total.monto),
      porEstado: states.rows.map((x) => ({
        estado: x.estado,
        cantidad: Number(x.cantidad),
        monto: Number(x.monto),
      })),
      porTipoCliente: types.rows.map((x) => ({
        nombre: x.nombre,
        cantidad: Number(x.cantidad),
        monto: Number(x.monto),
      })),
      porReferidor: referrers.rows.map((x) => ({
        nombre: x.nombre,
        cantidad: Number(x.cantidad),
        monto: Number(x.monto),
      })),
      montoAceptado: Number(total.monto_aceptado),
      tasaConversion: accepted + rejected ? accepted / (accepted + rejected) : null,
      comisionTotal: commission,
      comisionLiquidada: paid,
      comisionPendiente: commission - paid,
    };
  };

  return { dashboard, summary };
}
