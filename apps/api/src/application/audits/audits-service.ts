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

export function createAuditsService(
  repo: ReturnType<typeof import('../../infrastructure/db/audits-repository.js').createAuditsRepository>,
) {
  return {
    plans: (q: AuditListQuery) => repo.plans(q),
    planningById: (id: string) => repo.planningById(id),
    createPlanning: (v: PlanningBody) => repo.createPlanning(v),
    updatePlanning: (id: string, v: PlanningUpdate) => repo.updatePlanning(id, v),
    cancelPlanning: (id: string, updatedAt: string) => repo.cancelPlanning(id, updatedAt),
    listAudits: (q: AuditPageQuery) => repo.listAudits(q),
    auditDetail: (id: string) => repo.auditDetail(id),
    dashboard: (q: DashboardQuery) => repo.dashboard(q),
    catalogs: () => repo.catalogs(),
    submit: (v: AuditSubmit, actor: string, key: string) => repo.submit(v, actor, key),
    listActionsForAudit: (auditId: string) => repo.listActionsForAudit(auditId),
    listActions: (q: ActionListQuery) => repo.listActions(q),
    createAction: (id: string, v: ActionCreate) => repo.createAction(id, v),
    updateAction: (id: string, v: ActionUpdate) => repo.updateAction(id, v),
    listChecklists: () => repo.listChecklists(),
    checklistDetail: (id: string) => repo.checklistDetail(id),
    checklistActive: () => repo.checklistActive(),
    checklistCreate: (v: ChecklistCreate) => repo.checklistCreate(v),
    checklistUpdate: (id: string, v: ChecklistUpdate) => repo.checklistUpdate(id, v),
    checklistCopy: (id: string, v: ChecklistCopy, actor: string, key: string) =>
      repo.checklistCopy(id, v, actor, key),
    checklistActivate: (id: string, updatedAt: string) => repo.checklistActivate(id, updatedAt),
  }
}
