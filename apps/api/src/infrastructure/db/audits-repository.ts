import type { Db } from './pool.js'
import { createAuditsPlanningMethods } from './audits/audits-planning.js'
import { createAuditsExecutionMethods } from './audits/audits-execution.js'
import { createAuditsActionsMethods } from './audits/audits-actions.js'
import { createAuditsChecklistsMethods } from './audits/audits-checklists.js'
import { createAuditsDashboardMethods } from './audits/audits-dashboard.js'

export function createAuditsRepository(db: Db) {
  const planning = createAuditsPlanningMethods(db)
  const execution = createAuditsExecutionMethods(db)
  const actions = createAuditsActionsMethods(db)
  const checklists = createAuditsChecklistsMethods(db)
  const { dashboard } = createAuditsDashboardMethods(db)

  return {
    ...planning,
    ...execution,
    dashboard,
    ...actions,
    ...checklists,
  }
}
