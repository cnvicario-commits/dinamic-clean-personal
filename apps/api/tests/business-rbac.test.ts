import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  ROLES,
  assertPermissionCatalogInvariants,
  authorize,
  isPermission,
  permissionsFor,
  type Permission,
  type Role,
} from '../src/domain/rbac.js'

/**
 * Productive ROLE_PERMISSIONS allowlist — must match evidence
 * `phase2c-rbac-grant-traceability.csv` CONFIRMED_ALLOW / BACKEND_ENFORCED rows.
 * Adding a sensitive business ALLOW without updating this + evidence MUST fail CI.
 */
const CONFIRMED_PRODUCTIVE_GRANTS: Readonly<Record<Role, readonly Permission[]>> = {
  admin: [
    'profile:read_self',
    'profile:update_self',
    'profiles:read_any',
    'users:create',
    'users:change_role',
    'users:set_password',
    'employees:read',
  ],
  gerente: ['profile:read_self', 'profile:update_self', 'employees:read'],
  compras: ['profile:read_self', 'profile:update_self'],
  supervisor: ['profile:read_self', 'profile:update_self'],
  auditoria: ['profile:read_self', 'profile:update_self'],
}

/** Catalog capabilities that must remain DENY for all roles until Phase 3+ confirms grants. */
const CATALOG_DENY_UNTIL_CONFIRMED: readonly Permission[] = [
  'employees:create',
  'employees:update',
  'assignments:read',
  'assignments:create',
  'assignments:update',
  'attendance:read',
  'attendance:update',
  'attendance:export',
  'clients:read',
  'clients:create',
  'client_addresses:read',
  'client_addresses:update',
  'client_quotes:read',
  'client_quotes:create',
  'client_quotes:delete',
  'companies:read',
  'companies:create',
  'companies:update',
  'suppliers:read',
  'suppliers:update',
  'articles:read',
  'articles:update',
  'articles:import',
  'purchase_requests:read',
  'purchase_requests:create',
  'purchase_requests:update',
  'purchase_orders:read',
  'purchase_orders:create',
  'purchase_orders:update',
  'warehouse_requests:read',
  'warehouse_requests:create',
  'warehouse_requests:update',
  'economic_results:read',
  'economic_results:import',
  'crm:read',
  'crm:create',
  'crm:update',
  'crm:delete',
  'audits:read',
  'audits:create',
  'audits:update',
  'audit_checklists:manage',
]

describe('business RBAC catalog (Phase 2C corrections)', () => {
  it('catalog invariants: unique, naming, no wildcards, grants ⊆ PERMISSIONS', () => {
    expect(() => assertPermissionCatalogInvariants()).not.toThrow()
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
    for (const p of PERMISSIONS) {
      expect(p).toMatch(/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/)
      expect(p.includes('*')).toBe(false)
    }
  })

  it('productive ROLE_PERMISSIONS match confirmed allowlist only (no UI-inferred grants)', () => {
    for (const role of ROLES) {
      expect([...permissionsFor(role)].sort()).toEqual(
        [...CONFIRMED_PRODUCTIVE_GRANTS[role]].sort(),
      )
    }
  })

  it('unknown permission → DENY for every role', () => {
    for (const role of ROLES) {
      expect(authorize({ role }, 'hr:manage_everything')).toBe(false)
      expect(authorize({ role }, 'employees:*')).toBe(false)
      expect(authorize({ role }, '*')).toBe(false)
    }
  })

  it('admin has no wildcard / no implicit all-catalog access', () => {
    expect(authorize({ role: 'admin' }, 'users:disable')).toBe(false)
    expect(permissionsFor('admin').some((p) => p.includes('*'))).toBe(false)
    expect(permissionsFor('admin').length).toBeLessThan(PERMISSIONS.length)
    for (const p of CATALOG_DENY_UNTIL_CONFIRMED) {
      expect(authorize({ role: 'admin' }, p), `admin must DENY unconfirmed ${p}`).toBe(false)
    }
  })

  it('role auditoria ≠ audits domain auto-access', () => {
    expect(authorize({ role: 'auditoria' }, 'employees:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'economic_results:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'crm:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'purchase_orders:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'audits:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'audits:create')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'audits:update')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'audit_checklists:manage')).toBe(false)
  })

  it('finance permissions stay in catalog but DENY all roles (UI/RLS alone insufficient)', () => {
    expect(isPermission('economic_results:read')).toBe(true)
    expect(isPermission('economic_results:import')).toBe(true)
    for (const role of ROLES) {
      expect(authorize({ role }, 'economic_results:read')).toBe(false)
      expect(authorize({ role }, 'economic_results:import')).toBe(false)
    }
  })

  it('purchasing catalog present; no productive grants for any role yet', () => {
    const purchasing: Permission[] = [
      'suppliers:read',
      'suppliers:update',
      'articles:read',
      'articles:import',
      'purchase_requests:read',
      'purchase_requests:create',
      'purchase_orders:read',
      'purchase_orders:create',
      'warehouse_requests:read',
      'warehouse_requests:update',
    ]
    for (const permission of purchasing) {
      expect(isPermission(permission)).toBe(true)
      for (const role of ROLES) {
        expect(authorize({ role }, permission)).toBe(false)
      }
    }
  })

  it('gerente/supervisor/compras: no audits grants from UI routes alone', () => {
    for (const role of ['gerente', 'supervisor', 'compras'] as Role[]) {
      expect(authorize({ role }, 'audits:read')).toBe(false)
      expect(authorize({ role }, 'audits:create')).toBe(false)
      expect(authorize({ role }, 'audit_checklists:manage')).toBe(false)
    }
  })

  const roleDiffCases: Array<{
    role: Role
    permission: Permission
    expected: boolean
  }> = [
    { role: 'admin', permission: 'employees:read', expected: true },
    { role: 'gerente', permission: 'employees:read', expected: true },
    { role: 'compras', permission: 'employees:read', expected: false },
    { role: 'admin', permission: 'users:change_role', expected: true },
    { role: 'gerente', permission: 'users:create', expected: false },
    { role: 'compras', permission: 'purchase_orders:read', expected: false },
    { role: 'supervisor', permission: 'purchase_requests:read', expected: false },
    { role: 'supervisor', permission: 'audits:read', expected: false },
    { role: 'gerente', permission: 'employees:create', expected: false },
    { role: 'admin', permission: 'clients:read', expected: false },
  ]

  it.each(roleDiffCases)(
    '$role × $permission → $expected',
    ({ role, permission, expected }) => {
      expect(authorize({ role }, permission)).toBe(expected)
    },
  )

  it('identity permissions unchanged for non-admin roles', () => {
    for (const role of ['gerente', 'compras', 'supervisor', 'auditoria'] as Role[]) {
      expect(authorize({ role }, 'profiles:read_any')).toBe(false)
      expect(authorize({ role }, 'users:create')).toBe(false)
      expect(authorize({ role }, 'users:change_role')).toBe(false)
      expect(authorize({ role }, 'users:set_password')).toBe(false)
    }
  })

  it('catalog-only business permissions → DENY for every role', () => {
    for (const permission of CATALOG_DENY_UNTIL_CONFIRMED) {
      for (const role of ROLES) {
        expect(authorize({ role }, permission)).toBe(false)
      }
    }
  })
})
