/**
 * Central RBAC policy — Phase 2A/2B/2C.
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
 * Phase 2C correction:
 * - PERMISSIONS = real enterprise actions (catalog).
 * - ROLE_PERMISSIONS = productive grants only when BACKEND_ENFORCED / CONFIRMED_ALLOW.
 * - UI_OBSERVED (RUTAS_PERMITIDAS / menu) is NOT sufficient for ALLOW.
 * - Catalog entry without grant ⇒ DENY (preferred over invented ALLOW).
 *
 * Permission naming: `<resource>:<action>` (see rbac-catalog.ts).
 */

import {
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from './rbac-catalog.js'

export { PERMISSIONS, ROLES, type Permission, type Role }

const ROLES_SET: ReadonlySet<string> = new Set(ROLES)
const PERMISSIONS_SET: ReadonlySet<string> = new Set(PERMISSIONS)

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES_SET.has(value)
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSIONS_SET.has(value)
}

const PERMISSION_NAME_RE = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/

/** Naming / catalog invariants used by tests. */
export function assertPermissionCatalogInvariants(): void {
  const seen = new Set<string>()
  for (const p of PERMISSIONS) {
    if (seen.has(p)) throw new Error(`duplicate permission: ${p}`)
    seen.add(p)
    if (!PERMISSION_NAME_RE.test(p)) throw new Error(`invalid permission name: ${p}`)
    if (p.includes('*')) throw new Error(`wildcard permission forbidden: ${p}`)
  }
  for (const role of ROLES) {
    for (const p of permissionsFor(role)) {
      if (!PERMISSIONS_SET.has(p)) {
        throw new Error(`ROLE_PERMISSIONS[${role}] references unknown ${p}`)
      }
      if (p.includes('*')) throw new Error(`wildcard grant forbidden: ${role}→${p}`)
    }
  }
}

const SELF_PROFILE = [
  'profile:read_self',
  'profile:update_self',
] as const satisfies readonly Permission[]

/**
 * Productive grants only (surfaced on GET /v1/me).
 *
 * CONFIRMED_ALLOW / BACKEND_ENFORCED today:
 * - profile:* — every authenticated role (GET/PATCH /v1/me)
 * - profiles:read_any, users:* — admin (users routes)
 * - Phase 3A Core HR — admin + gerente (employees/assignments endpoints)
 *
 * All other catalog permissions intentionally unmapped → DENY until confirmed.
 */
const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = Object.freeze({
  admin: Object.freeze([
    ...SELF_PROFILE,
    'profiles:read_any',
    'users:create',
    'users:change_role',
    'users:set_password',
    'users:disable',
    'users:enable',
    'employees:read',
    'employees:create',
    'employees:update',
    'assignments:read',
    'assignments:create',
    'assignments:update',
    'attendance:read','attendance:update',
    'attendance:export',
  ] as const satisfies readonly Permission[]),
  gerente: Object.freeze([
    ...SELF_PROFILE,
    'employees:read',
    'employees:create',
    'employees:update',
    'assignments:read',
    'assignments:create',
    'assignments:update',
    'attendance:read','attendance:update',
    'attendance:export',
  ] as const satisfies readonly Permission[]),
  compras: Object.freeze([...SELF_PROFILE] as const satisfies readonly Permission[]),
  supervisor: Object.freeze([...SELF_PROFILE] as const satisfies readonly Permission[]),
  auditoria: Object.freeze([...SELF_PROFILE] as const satisfies readonly Permission[]),
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
