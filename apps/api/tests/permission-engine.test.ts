import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  ROLES,
  authorize,
  isPermission,
  isRole,
  permissionsFor,
  type Permission,
  type Role,
} from '../src/domain/rbac.js'

describe('permission engine (Phase 2A)', () => {
  it('1. explicit grant → ALLOW', () => {
    expect(authorize({ role: 'admin' }, 'employees:read')).toBe(true)
    expect(authorize({ role: 'gerente' }, 'profile:read_self')).toBe(true)
  })

  it('2. permission not assigned → DENY', () => {
    expect(authorize({ role: 'compras' }, 'employees:read')).toBe(false)
    expect(authorize({ role: 'supervisor' }, 'employees:read')).toBe(false)
    expect(authorize({ role: 'auditoria' }, 'employees:read')).toBe(false)
  })

  it('3. unknown role → DENY', () => {
    expect(authorize({ role: 'superadmin' }, 'profile:read_self')).toBe(false)
    expect(authorize({ role: '' }, 'profile:read_self')).toBe(false)
    expect(isRole('superadmin')).toBe(false)
  })

  it('4. unknown permission → DENY', () => {
    expect(authorize({ role: 'admin' }, 'users:delete')).toBe(false)
    expect(authorize({ role: 'admin' }, '*')).toBe(false)
    expect(isPermission('users:delete')).toBe(false)
    expect(isPermission('*')).toBe(false)
  })

  it('5–6. subject null / undefined → DENY', () => {
    expect(authorize(null, 'profile:read_self')).toBe(false)
    expect(authorize(undefined, 'employees:read')).toBe(false)
  })

  it('7. role null / undefined → DENY', () => {
    expect(authorize({ role: null }, 'profile:read_self')).toBe(false)
    expect(authorize({ role: undefined }, 'employees:read')).toBe(false)
  })

  it('8. admin without explicit grant → DENY', () => {
    expect(authorize({ role: 'admin' }, 'users:change_role')).toBe(false)
    expect(authorize({ role: 'admin' }, 'profiles:read_any')).toBe(false)
    expect(permissionsFor('admin')).not.toContain('*' as Permission)
  })

  it('9. gerente without explicit grant → DENY', () => {
    expect(authorize({ role: 'gerente' }, 'users:change_role')).toBe(false)
    expect(authorize({ role: 'gerente' }, 'users:create')).toBe(false)
  })

  it('10. catalogs are not accidentally mutable', () => {
    const before = [...permissionsFor('admin')]
    const perms = permissionsFor('admin') as Permission[]
    expect(() => {
      perms.push('employees:read')
    }).toThrow()
    expect([...permissionsFor('admin')]).toEqual(before)
    expect(Object.isFrozen(ROLES)).toBe(true)
    expect(Object.isFrozen(PERMISSIONS)).toBe(true)
  })

  it('11. authorize is the sole public policy (consistent allow/deny matrix)', () => {
    const roles: Role[] = ['admin', 'gerente', 'compras', 'supervisor', 'auditoria']
    const permissions: Permission[] = ['profile:read_self', 'employees:read']
    for (const role of roles) {
      for (const permission of permissions) {
        const expected = permissionsFor(role).includes(permission)
        expect(authorize({ role }, permission)).toBe(expected)
      }
    }
  })

  it('12. no permissive fallback grants permissions', () => {
    expect(authorize({ role: 'admin' }, '')).toBe(false)
    expect(authorize({ role: 'admin' }, 'employees:read ')).toBe(false)
    expect(authorize({ role: 'ADMIN' }, 'employees:read')).toBe(false)
    expect(authorize({ role: 'admin ' }, 'employees:read')).toBe(false)
    expect(authorize({} as { role: unknown }, 'profile:read_self')).toBe(false)
  })

  it('every known role has explicit profile:read_self grant', () => {
    for (const role of ROLES) {
      expect(authorize({ role }, 'profile:read_self')).toBe(true)
    }
  })
})
