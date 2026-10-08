/**
 * Read-only Phase 2D capability probe for public.perfiles.
 * Used by /readyz — never writes.
 *
 * Deliberate model (documented):
 *   shared backend role `dinamic_api`
 *   + Fastify primary authorization
 *   + column-level grants + RLS policies TO dinamic_api (USING/WITH CHECK true)
 *   as second barrier — NOT BYPASSRLS, NOT service-role table writes.
 */

export type Phase2dCapabilityResult =
  | { ok: true }
  | { ok: false; reason: string }

export const PHASE2D_EXPECTED_DB_ROLE = 'dinamic_api'

const REQUIRED_POLICIES = [
  'perfiles_dinamic_api_select',
  'perfiles_dinamic_api_insert',
  'perfiles_dinamic_api_update',
] as const

type QueryFn = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: T[] }>

export async function probePhase2dProfilesCapabilities(
  query: QueryFn,
  expectedRole: string = PHASE2D_EXPECTED_DB_ROLE,
): Promise<Phase2dCapabilityResult> {
  const userRes = await query<{ current_user: string }>('select current_user')
  const currentUser = userRes.rows[0]?.current_user
  if (!currentUser) {
    return { ok: false, reason: 'missing_current_user' }
  }
  if (currentUser !== expectedRole) {
    return { ok: false, reason: 'unexpected_db_role' }
  }

  const roleAttr = await query<{
    rolsuper: boolean
    rolbypassrls: boolean
  }>(
    `select rolsuper, rolbypassrls
     from pg_roles
     where rolname = current_user`,
  )
  const attrs = roleAttr.rows[0]
  if (!attrs) {
    return { ok: false, reason: 'role_attributes_missing' }
  }
  if (attrs.rolsuper) {
    return { ok: false, reason: 'db_role_is_superuser' }
  }
  if (attrs.rolbypassrls) {
    return { ok: false, reason: 'db_role_has_bypassrls' }
  }

  const priv = await query<{
    has_select: boolean
    has_delete: boolean
    col_insert_id: boolean
    col_insert_nombre: boolean
    col_insert_rol: boolean
    col_update_nombre: boolean
    col_update_rol: boolean
    col_update_id: boolean
    col_update_created: boolean
  }>(
    `select
       has_table_privilege(current_user, 'public.perfiles', 'select') as has_select,
       has_table_privilege(current_user, 'public.perfiles', 'delete') as has_delete,
       has_column_privilege(current_user, 'public.perfiles', 'id', 'insert') as col_insert_id,
       has_column_privilege(current_user, 'public.perfiles', 'nombre_completo', 'insert') as col_insert_nombre,
       has_column_privilege(current_user, 'public.perfiles', 'rol', 'insert') as col_insert_rol,
       has_column_privilege(current_user, 'public.perfiles', 'nombre_completo', 'update') as col_update_nombre,
       has_column_privilege(current_user, 'public.perfiles', 'rol', 'update') as col_update_rol,
       has_column_privilege(current_user, 'public.perfiles', 'id', 'update') as col_update_id,
       has_column_privilege(current_user, 'public.perfiles', 'created_at', 'update') as col_update_created`,
  )
  const p = priv.rows[0]
  if (!p) {
    return { ok: false, reason: 'privilege_probe_failed' }
  }
  if (!p.has_select) {
    return { ok: false, reason: 'missing_select_privilege' }
  }
  // Column-level INSERT/UPDATE are the Phase 2D least-privilege grants.
  // has_table_privilege(...'insert'|'update') can be false when only column grants exist.
  if (!p.col_insert_id || !p.col_insert_nombre || !p.col_insert_rol) {
    return { ok: false, reason: 'missing_insert_privilege' }
  }
  if (!p.col_update_nombre || !p.col_update_rol) {
    return { ok: false, reason: 'missing_update_privilege' }
  }
  if (p.has_delete) {
    return { ok: false, reason: 'unexpected_delete_privilege' }
  }
  if (p.col_update_id || p.col_update_created) {
    return { ok: false, reason: 'unexpected_system_column_update' }
  }

  const rls = await query<{ relrowsecurity: boolean }>(
    `select c.relrowsecurity
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'perfiles'`,
  )
  if (!rls.rows[0]?.relrowsecurity) {
    return { ok: false, reason: 'rls_not_enabled' }
  }

  const policies = await query<{ polname: string }>(
    `select pol.polname::text as polname
     from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'perfiles'`,
  )
  const names = new Set(policies.rows.map((r) => r.polname))
  for (const required of REQUIRED_POLICIES) {
    if (!names.has(required)) {
      return { ok: false, reason: `missing_policy_${required}` }
    }
  }

  return { ok: true }
}
