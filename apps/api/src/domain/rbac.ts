/**
 * Central RBAC catalog — Phase 2A.
 *
 * Enforcement path (single policy):
 *   requirePermission(permission)
 *     → authorize(subject, permission)   // ONLY public authorization policy
 *       → roleHasPermission(role, perm)  // internal role×permission helper
 *
 * Rules:
 * - Deny by default (missing mapping ⇒ false).
 * - No implicit admin / gerente bypass / wildcards.
 * - Authentication (JWT + profile) is separate; this module is Authorization only.
 * - Do not call roleHasPermission from HTTP/routes — use authorize().
 *
 * Permission naming (Phase 2 convention — do not mix styles):
 *   Format:  <resource>:<action>
 *   Scope:   encode on the action when needed (`read_self`, `read_any`, `update_self`)
 *   Examples (enforced today): `profile:read_self`, `employees:read`
 *   Future:  `users:change_role`, `profiles:read_any`
 *   Avoid:   `users.read.any`, `profile.read.self`, mixed `:` / `.` schemes
 */

export type Role = 'admin' | 'gerente' | 'compras' | 'supervisor' | 'auditoria'

export const ROLES: readonly Role[] = Object.freeze([
  'admin',
  'gerente',
  'compras',
  'supervisor',
  'auditoria',
] as const)

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Permissions currently enforced by the Fastify API.
 * Convention: `<resource>:<action>` (see file header).
 */
export type Permission = 'profile:read_self' | 'employees:read'

export const PERMISSIONS: readonly Permission[] = Object.freeze([
  'profile:read_self',
  'employees:read',
] as const)

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value)
}

/**
 * Explicit grants only. Do not add wildcard "*" or admin auto-allow.
 * Frozen so tests can detect accidental mutation.
 */
const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  admin: Object.freeze(['profile:read_self', 'employees:read'] as const),
  gerente: Object.freeze(['profile:read_self', 'employees:read'] as const),
  compras: Object.freeze(['profile:read_self'] as const),
  supervisor: Object.freeze(['profile:read_self'] as const),
  auditoria: Object.freeze(['profile:read_self'] as const),
})

/** Read-only grant list for responses (e.g. GET /v1/me). Not an enforcement API. */
export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Internal role×permission check. Unknown role / permission ⇒ DENY.
 * Not exported: callers must go through authorize() so future contextual rules
 * (resource ownership, request metadata) have a single place to land.
 */
function roleHasPermission(role: unknown, permission: unknown): boolean {
  if (!isRole(role)) return false
  if (!isPermission(permission)) return false
  return permissionsFor(role).includes(permission)
}

/** Minimal auth slice for authorize() — avoids coupling to Fastify request types */
export type AuthorizationSubject = {
  role: unknown
} | null | undefined

/**
 * Canonical authorization policy.
 * Missing subject / role / permission / grant ⇒ DENY.
 * Admin and gerente do not bypass — they need an explicit ROLE_PERMISSIONS entry.
 */
export function authorize(subject: AuthorizationSubject, permission: unknown): boolean {
  if (subject == null) return false
  return roleHasPermission(subject.role, permission)
}
