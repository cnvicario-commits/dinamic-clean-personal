import type {
  CrmAgendaQuery,
  CrmConvertLead,
  CrmCreateFollowUp,
  CrmCreateLead,
  CrmCreateLeadFollowUp,
  CrmCreateOpportunity,
  CrmCreateProspect,
  CrmLeadListQuery,
  CrmLeadTransition,
  CrmListQuery,
  CrmMonthlyQuery,
  CrmTransition,
  CrmUpdateLead,
  CrmUpdateOpportunity,
  CrmUpdateProspect,
} from "../../http/schemas/crm.js";
import { forcedResponsableId, type CrmScope } from "../../domain/crm-scope.js";
import { fillMonthly, monthlyWindow } from "./crm-monthly.js";

export function createCrmService(
  repo: ReturnType<typeof import("../../infrastructure/db/crm-repository.js").createCrmRepository>,
) {
  return {
    list: (q: CrmListQuery, scope: CrmScope) => repo.list(q, scope),
    dashboard: (a: string, q: CrmListQuery, scope: CrmScope) => repo.dashboard(a, q, scope),
    summary: (q: CrmListQuery, scope: CrmScope) => repo.summary(q, scope),
    monthly: async (q: CrmMonthlyQuery, scope: CrmScope, now = new Date()) => {
      const window = monthlyWindow(q.desde, q.hasta, now);
      const rows = await repo.monthly(q, scope, window);
      return fillMonthly(window.desde, window.hasta, rows.creadas, rows.aceptadas);
    },
    agenda: (q: CrmAgendaQuery, scope: CrmScope) => repo.agenda(q, scope),
    detail: (id: string, scope: CrmScope) => repo.detail(id, scope),
    catalogs: () => repo.catalogs(),
    followUps: (id: string, q: { page: number; pageSize: number }, scope: CrmScope) =>
      repo.followUps(id, q, scope),
    createProspect: (v: CrmCreateProspect) => repo.createProspect(v),
    updateProspect: (id: string, v: CrmUpdateProspect, scope: CrmScope) =>
      repo.updateProspect(id, v, scope),
    createOpportunity: (v: CrmCreateOpportunity, scope: CrmScope, k: string) =>
      repo.createOpportunity(
        { ...v, responsableId: forcedResponsableId(scope, v.responsableId) },
        scope.userId,
        k,
      ),
    updateOpportunity: (id: string, v: CrmUpdateOpportunity, scope: CrmScope) =>
      repo.updateOpportunity(id, v, scope),
    transition: (id: string, v: CrmTransition, scope: CrmScope) =>
      repo.transition(id, v, scope.userId, scope),
    createFollowUp: (id: string, v: CrmCreateFollowUp, scope: CrmScope) =>
      repo.createFollowUp(id, v, scope.userId, scope),
    deleteOpportunity: (id: string, scope: CrmScope) => repo.deleteOpportunity(id, scope),
    markViewed: (id: string, scope: CrmScope) => repo.markViewed(id, scope.userId, scope),
    listLeads: (q: CrmLeadListQuery, scope: CrmScope) => repo.listLeads(q, scope),
    detailLead: (id: string, scope: CrmScope) => repo.detailLead(id, scope),
    createLead: (v: CrmCreateLead, scope: CrmScope, k: string) =>
      repo.createLead({ ...v, responsableId: forcedResponsableId(scope, v.responsableId) }, scope, k),
    updateLead: (id: string, v: CrmUpdateLead, scope: CrmScope) => repo.updateLead(id, v, scope),
    transitionLead: (id: string, v: CrmLeadTransition, scope: CrmScope) =>
      repo.transitionLead(id, v, scope),
    followUpsLead: (id: string, q: { page: number; pageSize: number }, scope: CrmScope) =>
      repo.followUpsLead(id, q, scope),
    createLeadFollowUp: (id: string, v: CrmCreateLeadFollowUp, scope: CrmScope) =>
      repo.createLeadFollowUp(id, v, scope),
    deleteLead: (id: string, scope: CrmScope) => repo.deleteLead(id, scope),
    convertLead: (id: string, v: CrmConvertLead, scope: CrmScope, k: string) =>
      repo.convertLead(id, { ...v, responsableId: forcedResponsableId(scope, v.responsableId) }, scope, k),
    catalog: (r: "tipos-cliente" | "tipos-servicio" | "referidores") => repo.catalog(r),
  };
}
