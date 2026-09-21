import type { Role } from './rbac-catalog.js'

/**
 * Roles that require Supabase Auth MFA assurance (AAL2) for privileged user-admin ops.
 * Catalog-only config — enforcement is server-side via requireAal / assertMfaAssurance.
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
 * Privileged user-admin operations that require step-up MFA when actor role is MFA-required.
 */
export function sessionMeetsMfaRequirement(
  actorRole: unknown,
  aal: AuthAssuranceLevel,
): boolean {
  if (!roleRequiresMfa(actorRole)) return true
  return aal === 'aal2'
}
