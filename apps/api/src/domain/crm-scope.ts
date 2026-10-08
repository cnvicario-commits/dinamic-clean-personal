import type { Role } from './rbac.js'

/** Row scope for CRM opportunities and leads. Only admin and gerente are global. */
export type CrmScope = { userId: string; global: boolean }

export function crmScope(actor: { userId: string; role: Role }): CrmScope {
  return { userId: actor.userId, global: actor.role === 'admin' || actor.role === 'gerente' }
}

/** Ventas cannot assign another user. Global roles keep the requested id. */
export function forcedResponsableId(scope: CrmScope, requested: string): string {
  return scope.global ? requested : scope.userId
}
