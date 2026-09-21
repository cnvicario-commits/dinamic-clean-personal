/**
 * Central RBAC catalog — Phase 2A/2B.
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
 * - permissionsFor() is presentation-only (e.g. GET /v1/me), never enforcement.
 *
 * Permission naming (Phase 2 convention):
 *   Format:  <resource>:<action>
 *   Scope:   encode on the action when needed (`read_self`, `read_any`, `update_self`)
 */

export const ROLES = Object.freeze([
  'admin',
  'gerente',
  'compras',
  'supervisor',
  'auditoria',
] as const)

export type Role = (typeof ROLES)[number]

const ROLES_SET: ReadonlySet<string> = new Set(ROLES)

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES_SET.has(value)
}

/**
 * Permissions enforced by the Fastify API.
 * Convention: `<resource>:<action>` (see file header).
 */
export const PERMISSIONS = Object.freeze([
  'profile:read_self',
  'profile:update_self',
  'profiles:read_any',
  'employees:read',
  'users:create',
  'users:change_role',
  'users:set_password',
] as const)

export type Permission = (typeof PERMISSIONS)[number]

const PERMISSIONS_SET: ReadonlySet<string> = new Set(PERMISSIONS)

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSIONS_SET.has(value)
}

/**
 * Explicit grants only. Do not add wildcard "*" or admin auto-allow.
 * Frozen so tests can detect accidental mutation.
 */
const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  admin: Object.freeze([
    'profile:read_self',
    'profile:update_self',
    'profiles:read_any',
    'employees:read',
    'users:create',
    'users:change_role',
    'users:set_password',
  ] as const satisfies readonly Permission[]),
  gerente: Object.freeze([
    'profile:read_self',
    'profile:update_self',
    'employees:read',
  ] as const satisfies readonly Permission[]),
  compras: Object.freeze([
    'profile:read_self',
    'profile:update_self',
  ] as const satisfies readonly Permission[]),
  supervisor: Object.freeze([
    'profile:read_self',
    'profile:update_self',
  ] as const satisfies readonly Permission[]),
  auditoria: Object.freeze([
    'profile:read_self',
    'profile:update_self',
  ] as const satisfies readonly Permission[]),
})

/** Read-only grant list for responses (e.g. GET /v1/me). Not an enforcement API. */
export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Internal role×permission check. Unknown role / permission ⇒ DENY.
 * Not exported: callers must go through authorize().
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
