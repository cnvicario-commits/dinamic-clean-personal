export type Role = 'admin' | 'gerente' | 'compras' | 'supervisor' | 'auditoria'

export const ROLES: readonly Role[] = [
  'admin',
  'gerente',
  'compras',
  'supervisor',
  'auditoria',
] as const

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

/** Permission catalog — deny by default if missing */
export type Permission =
  | 'profile:read_self'
  | 'employees:read'

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ['profile:read_self', 'employees:read'],
  gerente: ['profile:read_self', 'employees:read'],
  compras: ['profile:read_self'],
  supervisor: ['profile:read_self'],
  auditoria: ['profile:read_self'],
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission)
}
