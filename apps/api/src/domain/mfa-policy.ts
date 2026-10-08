import type { Role } from './rbac-catalog.js'

/**
 * Roles that require Supabase Auth MFA assurance (AAL2) for privileged user-admin
 * **mutations** (create / change_role / set_password / disable / enable).
 *
 * Fail-closed: missing or unknown `aal` claim is NEVER treated as aal2.
 *
 * Explicitly NOT MFA-gated (read-only):
 * - GET /v1/users
 * - GET /v1/users/:id
 * - GET/PATCH /v1/me
 * - GET /v1/employees
 *
 * gerente is intentionally NOT included until product confirms.
 */
export const MFA_REQUIRED_ROLES: readonly Role[] = Object.freeze(['admin'])

export type AuthAssuranceLevel = 'aal1' | 'aal2' | 'unknown'

export function parseAal(value: unknown): AuthAssuranceLevel {
  if (value === 'aal1' || value === 'aal2') return value
  return 'unknown'
}

export function roleRequiresMfa(role: unknown): boolean {
  return typeof role === 'string' && (MFA_REQUIRED_ROLES as readonly string[]).includes(role)
}

/**
 * Privileged user-admin mutations when actor role is MFA-required.
 * aal2 → allow; aal1 / unknown / missing → deny.
 */
export function sessionMeetsMfaRequirement(
  actorRole: unknown,
  aal: AuthAssuranceLevel,
): boolean {
  if (!roleRequiresMfa(actorRole)) return true
  return aal === 'aal2'
}
