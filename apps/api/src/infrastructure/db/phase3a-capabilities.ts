/** Read-only materialized contract probe for the Phase 3A HR database boundary. */

export type Phase3aCapabilityResult =
  | { ok: true; currentUser: string }
  | { ok: false; reason: string; currentUser?: string }

type QueryFn = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: T[] }>

const TABLES = ['perfiles', 'clientes', 'empleados', 'asignaciones'] as const
const POLICY_CONTRACT = [
  ['empleados', 'empleados_dinamic_api_select', 'SELECT'],
  ['empleados', 'empleados_dinamic_api_insert', 'INSERT'],
  ['empleados', 'empleados_dinamic_api_update', 'UPDATE'],
  ['asignaciones', 'asignaciones_dinamic_api_select', 'SELECT'],
  ['asignaciones', 'asignaciones_dinamic_api_insert', 'INSERT'],
  ['asignaciones', 'asignaciones_dinamic_api_update', 'UPDATE'],
] as const

const REQUIRED_COLUMNS = [
  ['empleados', 'insert', 'nombre_apellido'],
  ['empleados', 'insert', 'cuil'],
  ['empleados', 'insert', 'legajo'],
  ['empleados', 'insert', 'fecha_ingreso'],
  ['empleados', 'insert', 'horas_contrato'],
  ['empleados', 'insert', 'empresa'],
  ['empleados', 'update', 'activo'],
  ['asignaciones', 'insert', 'empleado_id'],
  ['asignaciones', 'insert', 'cliente_id'],
  ['asignaciones', 'insert', 'fecha_desde'],
  ['asignaciones', 'update', 'fecha_hasta'],
] as const

export const PHASE3A_POLICY_NAMES = POLICY_CONTRACT.map(([, name]) => name)

export async function probePhase3aCapabilities(query: QueryFn): Promise<Phase3aCapabilityResult> {
  const identity = await query<{ current_user: string; current_schema: string }>(
    'select current_user, current_schema()',
  )
  const currentUser = identity.rows[0]?.current_user
  if (!currentUser) return { ok: false, reason: 'missing_current_user' }
  if (currentUser !== 'dinamic_api') return { ok: false, reason: 'unexpected_db_role', currentUser }
  if (identity.rows[0]?.current_schema !== 'public') {
    return { ok: false, reason: 'unexpected_db_schema', currentUser }
  }

  const attrs = await query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
  )
  if (!attrs.rows[0]) return { ok: false, reason: 'role_attributes_missing', currentUser }
  if (attrs.rows[0].rolsuper) return { ok: false, reason: 'db_role_is_superuser', currentUser }
  if (attrs.rows[0].rolbypassrls) return { ok: false, reason: 'db_role_has_bypassrls', currentUser }

  const tables = await query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name = any($1::text[])`,
    [TABLES],
  )
  const presentTables = new Set(tables.rows.map((row) => row.table_name))
  for (const table of TABLES) {
    if (!presentTables.has(table)) return { ok: false, reason: `missing_table_public_${table}`, currentUser }
  }

  const privileges = await query<{
    table_name: string
    privilege_type: string
    column_name: string | null
  }>(
    `select table_name, privilege_type, column_name
     from information_schema.column_privileges
     where table_schema = 'public' and grantee = current_user
       and table_name = any($1::text[])
       and privilege_type in ('SELECT', 'INSERT', 'UPDATE')`,
    [TABLES],
  )
  const privilegeSet = new Set(
    privileges.rows.map((row) => `${row.table_name}:${row.privilege_type}:${row.column_name ?? '*'}`),
  )
  for (const [table, privilege, column] of REQUIRED_COLUMNS) {
    const required = `${table}:${privilege.toUpperCase()}:${column ?? '*'}`
    if (!privilegeSet.has(required)) {
      return { ok: false, reason: `missing_privilege_${required.replaceAll(':', '_')}`, currentUser }
    }
  }

  const tableSelect = await query<{ table_name: string }>(
    `select table_name from information_schema.role_table_grants
     where table_schema = 'public' and grantee = current_user
       and table_name in ('empleados', 'asignaciones', 'clientes')
       and privilege_type = 'SELECT'`,
  )
  const selectedTables = new Set(tableSelect.rows.map((row) => row.table_name))
  for (const table of ['empleados', 'asignaciones', 'clientes']) {
    if (!selectedTables.has(table)) {
      return { ok: false, reason: `missing_privilege_${table}_SELECT`, currentUser }
    }
  }

  const browserDml = await query<{ grantee: string; table_name: string; privilege_type: string }>(
    `select grantee, table_name, privilege_type
     from information_schema.role_table_grants
     where table_schema = 'public'
       and grantee in ('anon', 'authenticated')
       and table_name in ('empleados', 'asignaciones')
       and privilege_type in ('INSERT', 'UPDATE')`,
  )
  if (browserDml.rows.length > 0) {
    return { ok: false, reason: 'browser_dml_privilege_present', currentUser }
  }

  const rls = await query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = any($1::text[])`,
    [['empleados', 'asignaciones']],
  )
  for (const row of rls.rows) {
    if (!row.relrowsecurity) return { ok: false, reason: `rls_not_enabled_${row.relname}`, currentUser }
  }

  const policies = await query<{
    tablename: string
    policyname: string
    cmd: string
    roles: string[]
  }>(
    `select c.relname as tablename, p.polname as policyname, p.polcmd as cmd,
            coalesce(array_agg(r.rolname) filter (where r.rolname is not null), '{}') as roles
     from pg_policy p
     join pg_class c on c.oid = p.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     left join pg_roles r on r.oid = any(p.polroles)
     where n.nspname = 'public' and c.relname in ('empleados', 'asignaciones')
     group by c.relname, p.polname, p.polcmd`,
  )
  for (const [table, policy, command] of POLICY_CONTRACT) {
    const expectedCmd = command === 'SELECT' ? 'r' : command === 'INSERT' ? 'a' : 'w'
    const found = policies.rows.some((row) =>
      row.tablename === table
      && row.policyname === policy
      && row.cmd === expectedCmd
      && row.roles.includes('dinamic_api'))
    if (!found) return { ok: false, reason: `missing_policy_${policy}`, currentUser }
  }

  return { ok: true, currentUser }
}
