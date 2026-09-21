/**
 * Pure RBAC catalogs (no Fastify / DB deps).
 * Source of truth for roles + permission names.
 *
 * ROLE_PERMISSIONS (grants) live in rbac.ts — catalog ≠ authorization.
 *
 * Convention: `<resource>:<action>` (optional scope on action: read_self, read_any, …).
 */

export const ROLES = Object.freeze([
  'admin',
  'gerente',
  'compras',
  'supervisor',
  'auditoria',
] as const)

export type Role = (typeof ROLES)[number]

/**
 * Enterprise capability catalog.
 * Presence here means the action exists in the product (or is Fastify-enforced).
 * It does NOT grant any role access — see ROLE_PERMISSIONS in rbac.ts.
 */
export const PERMISSIONS = Object.freeze([
  // Identity (Phase 2A–2B) — Fastify-enforced where granted
  'profile:read_self',
  'profile:update_self',
  'profiles:read_any',
  'users:create',
  'users:change_role',
  'users:set_password',
  'users:disable',
  'users:enable',
  // HR — employees:read enforced on GET /v1/employees; others catalog-only until Phase 3
  'employees:read',
  'employees:create',
  'employees:update',
  'assignments:read',
  'assignments:create',
  'assignments:update',
  'attendance:read',
  'attendance:update',
  'attendance:export',
  // Clients + nested
  'clients:read',
  'clients:create',
  'client_addresses:read',
  'client_addresses:update',
  'client_quotes:read',
  'client_quotes:create',
  'client_quotes:delete',
  // Companies
  'companies:read',
  'companies:create',
  'companies:update',
  // Purchasing (distinct resources)
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
  // Finance (P0) — catalog only until functional grant confirmed beyond UI/RLS
  'economic_results:read',
  'economic_results:import',
  // CRM
  'crm:read',
  'crm:create',
  'crm:update',
  'crm:delete',
  // Operational audits (≠ role name `auditoria`)
  'audits:read',
  'audits:create',
  'audits:update',
  'audit_checklists:manage',
] as const)

export type Permission = (typeof PERMISSIONS)[number]
