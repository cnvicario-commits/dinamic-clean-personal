import type pg from "pg";
import type { Db } from "../pool.js";
import { conflict } from "../../../http/errors/app-error.js";
import type { CrmScope } from "../../../domain/crm-scope.js";
import type {
  CrmAgendaQuery,
  CrmConvertLead,
  CrmCreateLead,
  CrmCreateLeadFollowUp,
  CrmCreateOpportunity,
  CrmLeadListQuery,
  CrmLeadTransition,
  CrmUpdateLead,
  CrmUpdateProspect,
} from "../../../http/schemas/crm.js";

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};
type First = <T>(rows: T[], message: string) => T;
type Idempotent = <T>(
  actor: string,
  operation: "opportunity_create" | "lead_create" | "lead_convert",
  key: string,
  payload: unknown,
  run: (c: pg.PoolClient) => Promise<T>,
) => Promise<{ replayed: boolean; response: T }>;

const leadSelect = `select l.*,
jsonb_build_object('id',p.id,'nombre',p.nombre,'tipo_cliente_id',p.tipo_cliente_id,'contacto_nombre',p.contacto_nombre,
'telefono',p.telefono,'email',p.email,'referido_por_id',p.referido_por_id,
'crm_tipos_cliente',case when tc.id is null then null else jsonb_build_object('nombre',tc.nombre) end,
'crm_referidores',case when r.id is null then null else jsonb_build_object('nombre',r.nombre) end) crm_prospectos,
case when pr.id is null then null else jsonb_build_object('nombre_completo',pr.nombre_completo) end perfiles
from public.crm_leads l join public.crm_prospectos p on p.id=l.prospecto_id
left join public.crm_tipos_cliente tc on tc.id=p.tipo_cliente_id
left join public.crm_referidores r on r.id=p.referido_por_id
left join public.perfiles pr on pr.id=l.responsable_id`;

function ownerFilter(scope: CrmScope, column: string, params: unknown[]): string {
  if (scope.global) return "";
  params.push(scope.userId);
  return ` and ${column}=$${params.length}`;
}

export function createCrmLeadMethods(
  db: Db,
  deps: {
    tx: <T>(db: Db, run: (c: pg.PoolClient) => Promise<T>) => Promise<T>;
    first: First;
    idempotent: Idempotent;
    insertOpportunity: (
      c: pg.PoolClient,
      v: CrmCreateOpportunity,
      actor: string,
    ) => Promise<Record<string, unknown>>;
    updateProspect: (id: string, v: CrmUpdateProspect, c: pg.PoolClient) => Promise<unknown>;
  },
) {
  const { tx, first, idempotent, insertOpportunity, updateProspect } = deps;
  const detailWith = async (c: Queryable, id: string, scope: CrmScope) => {
    const params: unknown[] = [id];
    return first(
      (await c.query(`${leadSelect} where l.id=$1${ownerFilter(scope, "l.responsable_id", params)}`, params))
        .rows,
      "Lead not found",
    );
  };
  const assertOwned = async (c: Queryable, id: string, scope: CrmScope, lock: "update" | "share") => {
    const params: unknown[] = [id];
    const filter = ownerFilter(scope, "responsable_id", params);
    const row = first(
      (
        await c.query(
          `select id,estado,prospecto_id from public.crm_leads where id=$1${filter} for ${lock === "update" ? "update" : "key share"}`,
          params,
        )
      ).rows,
      "Lead not found",
    );
    return {
      id: String(row.id),
      estado: String(row.estado),
      prospecto_id: String(row.prospecto_id),
    };
  };
  const list = async (q: CrmLeadListQuery, scope: CrmScope) => {
    const params: unknown[] = [];
    const clauses: string[] = [];
    const value = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (!scope.global) clauses.push(`l.responsable_id=${value(scope.userId)}`);
    else if (q.responsableId) clauses.push(`l.responsable_id=${value(q.responsableId)}`);
    if (q.estado) clauses.push(`l.estado=${value(q.estado)}`);
    if (q.search) clauses.push(`p.nombre ilike ${value(`%${q.search}%`)}`);
    const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
    const from = " from public.crm_leads l join public.crm_prospectos p on p.id=l.prospecto_id";
    const total = await db.query<{ count: string }>(
      `select count(*)::text count${from}${where}`,
      params,
    );
    const pageParams = [...params, (q.page - 1) * q.pageSize, q.pageSize];
    const rows = await db.query(
      `${leadSelect}${where} order by l.created_at desc,l.id desc offset $${pageParams.length - 1} limit $${pageParams.length}`,
      pageParams,
    );
    return {
      items: rows.rows,
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total.rows[0]?.count ?? 0),
    };
  };
  const followUps = async (id: string, q: { page: number; pageSize: number }, scope: CrmScope) => {
    await detailWith(db, id, scope);
    const total = await db.query<{ count: string }>(
      "select count(*)::text count from public.crm_seguimientos_leads where lead_id=$1",
      [id],
    );
    const rows = await db.query(
      `select s.*,case when p.id is null then null else jsonb_build_object('nombre_completo',p.nombre_completo) end perfiles
from public.crm_seguimientos_leads s left join public.perfiles p on p.id=s.usuario_id
where s.lead_id=$1 order by s.fecha_contacto desc,s.created_at desc offset $2 limit $3`,
      [id, (q.page - 1) * q.pageSize, q.pageSize],
    );
    return {
      items: rows.rows,
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total.rows[0]?.count ?? 0),
    };
  };
  const insertFollowUp = async (
    c: pg.PoolClient,
    leadId: string,
    actor: string,
    note: string,
    extra?: { fechaContacto?: string | null; tipoContacto?: string | null; proximaFechaContacto?: string | null },
  ) =>
    first(
      (
        await c.query(
          `insert into public.crm_seguimientos_leads(lead_id,fecha_contacto,tipo_contacto,nota,proxima_fecha_contacto,usuario_id)
values($1,coalesce($2::date,current_date),$3,$4,$5,$6) returning *`,
          [
            leadId,
            extra?.fechaContacto ?? null,
            extra?.tipoContacto ?? null,
            note,
            extra?.proximaFechaContacto ?? null,
            actor,
          ],
        )
      ).rows,
      "Lead follow-up creation failed",
    );
  return {
    listLeads: list,
    detailLead: (id: string, scope: CrmScope) => detailWith(db, id, scope),
    followUpsLead: followUps,
    async createLead(v: CrmCreateLead, scope: CrmScope, key: string) {
      return idempotent(scope.userId, "lead_create", key, v, async (c) => {
        first(
          (await c.query("select id from public.crm_prospectos where id=$1 for key share", [v.prospectoId])).rows,
          "Prospect not found",
        );
        first(
          (await c.query("select id from public.perfiles where id=$1 for key share", [v.responsableId])).rows,
          "Responsible not found",
        );
        const lead = first(
          (
            await c.query(
              `insert into public.crm_leads(prospecto_id,responsable_id,proxima_fecha_contacto,notas)
values($1,$2,$3,$4) returning id`,
              [v.prospectoId, v.responsableId, v.proximaFechaContacto, v.notas],
            )
          ).rows,
          "Lead creation failed",
        );
        await insertFollowUp(c, String(lead.id), scope.userId, "Lead creado.");
        return detailWith(c, String(lead.id), scope);
      });
    },
    async updateLead(id: string, v: CrmUpdateLead, scope: CrmScope) {
      return tx(db, async (c) => {
        const current = await assertOwned(c, id, scope, "update");
        const sets: string[] = [];
        const params: unknown[] = [id];
        if (v.proximaFechaContacto !== undefined) {
          params.push(v.proximaFechaContacto);
          sets.push(`proxima_fecha_contacto=$${params.length}`);
        }
        if (v.notas !== undefined) {
          params.push(v.notas);
          sets.push(`notas=$${params.length}`);
        }
        if (sets.length) await c.query(`update public.crm_leads set ${sets.join(",")} where id=$1`, params);
        if (v.prospecto) await updateProspect(current.prospecto_id, v.prospecto, c);
        return detailWith(c, id, scope);
      });
    },
    async transitionLead(id: string, v: CrmLeadTransition, scope: CrmScope) {
      return tx(db, async (c) => {
        const current = await assertOwned(c, id, scope, "update");
        if (current.estado === "convertido") throw conflict("Converted leads cannot change state");
        if (current.estado !== v.estado) {
          await c.query("update public.crm_leads set estado=$2 where id=$1", [id, v.estado]);
          await insertFollowUp(
            c,
            id,
            scope.userId,
            `Estado cambiado de "${current.estado}" a "${v.estado}".`,
          );
        }
        return detailWith(c, id, scope);
      });
    },
    async createLeadFollowUp(id: string, v: CrmCreateLeadFollowUp, scope: CrmScope) {
      return tx(db, async (c) => {
        await assertOwned(c, id, scope, "share");
        return insertFollowUp(c, id, scope.userId, v.nota, {
          fechaContacto: v.fechaContacto ?? null,
          tipoContacto: v.tipoContacto,
          proximaFechaContacto: v.proximaFechaContacto,
        });
      });
    },
    async deleteLead(id: string, scope: CrmScope) {
      await tx(db, async (c) => {
        const params: unknown[] = [id];
        const filter = ownerFilter(scope, "responsable_id", params);
        first(
          (await c.query(`delete from public.crm_leads where id=$1${filter} returning id`, params)).rows,
          "Lead not found",
        );
      });
    },
    async convertLead(id: string, v: CrmConvertLead, scope: CrmScope, key: string) {
      return idempotent(scope.userId, "lead_convert", key, { leadId: id, ...v }, async (c) => {
        const current = await assertOwned(c, id, scope, "update");
        if (current.estado === "convertido") throw conflict("Lead already converted");
        const opportunity = await insertOpportunity(
          c,
          {
            prospectoId: current.prospecto_id,
            numeroReferencia: v.numeroReferencia,
            fechaIngreso: v.fechaIngreso,
            tipoServicioId: v.tipoServicioId,
            cantidadPersonal: v.cantidadPersonal,
            montoEstimado: v.montoEstimado,
            fechaEnvio: v.fechaEnvio,
            comisionMonto: v.comisionMonto,
            comentarios: v.comentarios,
            responsableId: v.responsableId,
            seguimientoInicial: v.seguimientoInicial,
          },
          scope.userId,
        );
        await c.query("update public.crm_leads set estado='convertido', oportunidad_id=$2 where id=$1", [
          id,
          opportunity.id,
        ]);
        await insertFollowUp(c, id, scope.userId, "Lead convertido a oportunidad.");
        const lead = await detailWith(c, id, scope);
        return { lead, opportunity };
      });
    },
    async agenda(q: CrmAgendaQuery, scope: CrmScope) {
      const params: unknown[] = [];
      const value = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };
      const owner = (column: string) => (scope.global ? "" : ` and ${column}=${value(scope.userId)}`);
      const filtro = (column: string) =>
        scope.global && q.responsableId ? ` and ${column}=${value(q.responsableId)}` : "";
      const opportunities =
        q.tipo === "lead"
          ? ""
          : `select o.id,'oportunidad' tipo,'/ventas/'||o.id::text href,p.nombre cliente,
coalesce(ts.nombre,'Sin tipo de servicio') subtitulo,o.proxima_fecha_seguimiento::text fecha,
o.responsable_id "responsableId",coalesce(pr.nombre_completo,'-') "responsableNombre",o.monto_estimado monto
from public.crm_oportunidades o join public.crm_prospectos p on p.id=o.prospecto_id
left join public.crm_tipos_servicio ts on ts.id=o.tipo_servicio_id
left join public.perfiles pr on pr.id=o.responsable_id
where o.estado='en_seguimiento'${owner("o.responsable_id")}${filtro("o.responsable_id")}`;
      const leads =
        q.tipo === "oportunidad"
          ? ""
          : `select l.id,'lead' tipo,'/ventas/leads/'||l.id::text href,p.nombre cliente,
coalesce(p.contacto_nombre,'Sin contacto') subtitulo,l.proxima_fecha_contacto::text fecha,
l.responsable_id "responsableId",coalesce(pr.nombre_completo,'-') "responsableNombre",null::numeric monto
from public.crm_leads l join public.crm_prospectos p on p.id=l.prospecto_id
left join public.perfiles pr on pr.id=l.responsable_id
where l.estado in ('por_contactar','en_conversacion')${owner("l.responsable_id")}${filtro("l.responsable_id")}`;
      const union = [opportunities, leads].filter(Boolean).join(" union all ");
      const total = await db.query<{ count: string }>(`select count(*)::text count from (${union}) agenda`, params);
      const pageParams = [...params, (q.page - 1) * q.pageSize, q.pageSize];
      const rows = await db.query<{
        id: string;
        tipo: "oportunidad" | "lead";
        href: string;
        cliente: string;
        subtitulo: string;
        fecha: string | null;
        responsableId: string;
        responsableNombre: string;
        monto: string | null;
      }>(
        `select * from (${union}) agenda order by fecha asc nulls last, tipo, id offset $${pageParams.length - 1} limit $${pageParams.length}`,
        pageParams,
      );
      return {
        items: rows.rows.map((row) => ({
          id: row.id,
          tipo: row.tipo,
          href: row.href,
          cliente: row.cliente,
          subtitulo: row.subtitulo,
          fecha: row.fecha,
          responsableId: row.responsableId,
          responsableNombre: row.responsableNombre,
          montoTexto:
            row.monto === null
              ? null
              : `$ ${Number(row.monto).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
        })),
        page: q.page,
        pageSize: q.pageSize,
        total: Number(total.rows[0]?.count ?? 0),
      };
    },
  };
}
