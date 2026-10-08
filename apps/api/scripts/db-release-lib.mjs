import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { extractProjectRefFromDatabaseUrl } from './supabase-project-ref.mjs'

const RELEVANT = /^(crm_|clientes|cliente_|proveedores|articulos|articulo_|pedidos_|ordenes_|resultados|auditor|perfiles|empleados|asignaciones|empresas|ausencias|asistencias|codigos_novedad)/

export function redact(text) {
  return String(text ?? '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]')
    .replace(/(password|service_role|secret|token)=([^\s&]+)/gi, '$1=[redacted]')
}

export function repoMigrations(repoRoot) {
  const dir = resolve(repoRoot, 'supabase/migrations/forward')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql') && !name.endsWith('.rollback.sql'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((filename) => {
      const sql = readFileSync(resolve(dir, filename), 'utf8')
      return {
        filename,
        checksum: createHash('sha256').update(sql).digest('hex'),
        risks: migrationRisks(sql),
      }
    })
}

export function migrationRisks(sql) {
  const risks = []
  const checks = [
    ['NOT NULL', /\bNOT NULL\b/i],
    ['UNIQUE', /\bUNIQUE\b/i],
    ['CHECK', /\bCHECK\s*\(/i],
    ['FK', /\bREFERENCES\b/i],
    ['DROP', /\bDROP\b/i],
    ['ALTER TYPE', /\bALTER\s+TYPE\b/i],
    ['RLS', /\bROW LEVEL SECURITY\b/i],
    ['GRANT/REVOKE', /\b(GRANT|REVOKE)\b/i],
    ['UPDATE', /\bUPDATE\s+[a-z0-9_".]+\s+SET\b/i],
    ['TRIGGER', /\bCREATE\s+(OR\s+REPLACE\s+)?TRIGGER\b/i],
  ]
  for (const [label, pattern] of checks) {
    if (pattern.test(sql)) risks.push(label)
  }
  return risks
}

export function historyComparison(historyError, compared) {
  if (historyError) {
    return {
      pending: null,
      drift: [{ filename: 'app_migrations.forward_history', kind: 'HISTORY_UNAVAILABLE' }],
    }
  }
  return { pending: compared.pending, drift: compared.drift }
}

export function compareMigrations(repo, applied) {
  const repoMap = new Map(repo.map((item) => [item.filename, item.checksum]))
  const appliedNames = new Set(applied.map((item) => item.filename))
  const drift = []
  for (const row of applied) {
    if (!repoMap.has(row.filename)) drift.push({ filename: row.filename, kind: 'DB_ONLY' })
    else if (repoMap.get(row.filename) !== row.checksum) drift.push({ filename: row.filename, kind: 'CHECKSUM' })
  }
  const pending = repo.filter((item) => !appliedNames.has(item.filename)).map((item) => item.filename)
  return { drift, pending }
}

export function evaluateEnvironmentGuard(input) {
  const target = (input.target ?? '').trim().toLowerCase()
  const dbRef = (input.dbRef ?? '').trim().toLowerCase()
  const expectedProjectRef = (input.expectedProjectRef ?? '').trim().toLowerCase()
  const testRef = (input.testRef ?? '').trim().toLowerCase()
  const productionRef = (input.productionRef ?? '').trim().toLowerCase()
  if (target === 'production' || target === 'staging') {
    if (input.purpose === 'destructive') return 'BLOCKED_BY_ENVIRONMENT_GUARD'
  }
  if (productionRef && dbRef && dbRef === productionRef && target === 'test') return 'BLOCKED_BY_ENVIRONMENT_GUARD'
  if (productionRef && testRef && productionRef === testRef) return 'BLOCKED_BY_ENVIRONMENT_GUARD'
  if (target === 'simulation') {
    if (productionRef && dbRef && dbRef === productionRef) return 'BLOCKED_BY_ENVIRONMENT_GUARD'
    if (testRef && dbRef && dbRef === testRef) return 'BLOCKED_BY_ENVIRONMENT_GUARD'
    if (input.purpose === 'destructive' && input.simulationConfirmed !== true) return 'BLOCKED_BY_ENVIRONMENT_GUARD'
    return null
  }
  if (expectedProjectRef && dbRef && expectedProjectRef !== dbRef) return 'BLOCKED_BY_ENVIRONMENT_GUARD'
  if (target === 'test' && testRef && dbRef && testRef !== dbRef) return 'BLOCKED_BY_ENVIRONMENT_GUARD'
  return null
}

export function projectRefFromDatabaseUrl(databaseUrl) {
  return extractProjectRefFromDatabaseUrl(databaseUrl)
}

export function databaseHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Returns null when a production dump may be restored onto the target. */
export function assertCloneTargets(input) {
  const sourceRef = (input.sourceRef ?? '').trim().toLowerCase()
  const targetRef = (input.targetRef ?? '').trim().toLowerCase()
  const productionRef = (input.productionRef ?? '').trim().toLowerCase()
  const testRef = (input.testRef ?? '').trim().toLowerCase()
  const simulationRef = (input.simulationRef ?? '').trim().toLowerCase()
  const host = (input.targetHost ?? '').trim().toLowerCase()
  if ((input.targetLabel ?? '').trim().toLowerCase() !== 'simulation') return 'target is not marked simulation'
  if (!productionRef || !testRef) return 'production and test project refs are required'
  if (!sourceRef || sourceRef !== productionRef) return 'source is not the production project'
  if (targetRef && targetRef === productionRef) return 'target is production'
  if (targetRef && targetRef === testRef) return 'target is test'
  if (sourceRef && targetRef && sourceRef === targetRef) return 'source and target project refs match'
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!local && (!simulationRef || targetRef !== simulationRef)) return 'target is not the declared simulation database'
  if (input.simulationConfirmed !== true) return 'simulation restore is not confirmed'
  return null
}

export async function readForwardHistory(databaseUrl, migrationsUrl) {
  const dbRef = projectRefFromDatabaseUrl(databaseUrl)
  const migrationsRef = projectRefFromDatabaseUrl(migrationsUrl)
  const historyUrl = migrationsUrl && migrationsRef && dbRef && migrationsRef === dbRef ? migrationsUrl : databaseUrl
  return withReadOnlyClient(historyUrl, async (client) => {
    const rows = await client.query(
      'select filename, checksum, applied_at from app_migrations.forward_history order by filename',
    )
    return rows.rows.map((row) => ({
      filename: String(row.filename),
      checksum: String(row.checksum),
      appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : String(row.applied_at ?? ''),
    }))
  })
}

export async function withReadOnlyClient(databaseUrl, run) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 20_000,
    ssl: /supabase\.co|pooler\.supabase/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  })
  const client = await pool.connect()
  try {
    await client.query('SET default_transaction_read_only = on')
    return await run(client)
  } finally {
    client.release()
    await pool.end()
  }
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error('unexpected identifier')
  return `"${name}"`
}

export async function collectInventory(client, repoRoot) {
  const version = await client.query('select version() as version, current_database() as current_database, current_user as current_user')
  const identity = version.rows[0]
  let history = []
  let historyError = null
  try {
    history = await readForwardHistory(process.env.DATABASE_URL, process.env.MIGRATIONS_DATABASE_URL)
  } catch (error) {
    historyError = redact(error instanceof Error ? error.message : 'history_unavailable')
  }
  const tables = await client.query(`
    select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls, c.reltuples::bigint as estimate
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `)
  const counts = []
  for (const table of tables.rows) {
    if (!RELEVANT.test(table.name)) continue
    const counted = await client.query(`select count(*)::bigint as n from public.${quoteIdent(table.name)}`)
    counts.push({ name: table.name, rows: String(counted.rows[0].n) })
  }
  const columns = await client.query(`
    select table_name, column_name, data_type, udt_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `)
  const constraints = await client.query(`
    select conrelid::regclass::text as table_name, conname, contype, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where connamespace = 'public'::regnamespace
    order by 1, 2
  `)
  const indexes = await client.query(`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `)
  const triggers = await client.query(`
    select c.relname as table_name, t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by 1, 2
  `)
  const policies = await client.query(`
    select tablename, policyname, cmd, roles::text as roles
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `)
  const grants = await client.query(`
    select c.relname as table_name, r.rolname as grantee, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join lateral aclexplode(c.relacl) a on true
    join pg_roles r on r.oid = a.grantee
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relacl is not null
      and r.rolname in ('anon', 'authenticated', 'dinamic_api', 'service_role')
    order by 1, 2, 3
  `)
  const repo = repoMigrations(repoRoot)
  const compared = historyComparison(historyError, compareMigrations(repo, history))
  return {
    identity: {
      version: String(identity.version).split(' ').slice(0, 2).join(' '),
      currentDatabase: String(identity.current_database),
      currentUser: String(identity.current_user),
    },
    historyError,
    history,
    tables: tables.rows.map((row) => ({
      name: row.name,
      rls: Boolean(row.rls),
      forceRls: Boolean(row.force_rls),
      estimate: String(row.estimate),
    })),
    counts,
    columns: columns.rows.map((row) => ({
      table: row.table_name,
      column: row.column_name,
      type: row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type,
      nullable: row.is_nullable,
    })),
    constraints: constraints.rows.map((row) => ({
      table: String(row.table_name),
      name: row.conname,
      type: row.contype,
      definition: row.definition,
    })),
    indexes: indexes.rows,
    triggers: triggers.rows,
    policies: policies.rows,
    grants: grants.rows,
    repo,
    pending: compared.pending,
    drift: compared.drift,
  }
}

export function renderInventory(label, inventory) {
  const lines = []
  const push = (value = '') => lines.push(value)
  push(`# ${label} read-only inventory`)
  push(`postgresql=${inventory.identity.version}`)
  push(`current_database=${inventory.identity.currentDatabase}`)
  push(`current_user=${inventory.identity.currentUser}`)
  push('')
  push('## app_migrations.forward_history')
  if (inventory.historyError) push(`history_error=${inventory.historyError}`)
  for (const row of inventory.history) push(`${row.filename} ${row.checksum} ${row.appliedAt}`)
  push('')
  push('## repo forward migrations')
  for (const row of inventory.repo) push(`${row.filename} ${row.checksum} risks=${row.risks.join(',') || 'none'}`)
  push('')
  push('## pending')
  if (inventory.pending == null) push('UNKNOWN')
  else {
    for (const name of inventory.pending) push(name)
    if (inventory.pending.length === 0) push('(none)')
  }
  push('')
  push('## checksum or unknown-file drift')
  for (const row of inventory.drift) push(`${row.kind} ${row.filename}`)
  if (inventory.drift.length === 0) push('(none)')
  push('')
  push('## relevant row counts')
  for (const row of inventory.counts) push(`${row.name} ${row.rows}`)
  push('')
  push('## tables rls')
  for (const row of inventory.tables) push(`${row.name} rls=${row.rls} force=${row.forceRls} estimate=${row.estimate}`)
  push('')
  push('## columns')
  for (const row of inventory.columns) push(`${row.table}.${row.column} ${row.type} nullable=${row.nullable}`)
  push('')
  push('## constraints')
  for (const row of inventory.constraints) push(`${row.table} ${row.name} ${row.type} ${row.definition}`)
  push('')
  push('## indexes')
  for (const row of inventory.indexes) push(`${row.tablename} ${row.indexname} ${row.indexdef}`)
  push('')
  push('## triggers')
  for (const row of inventory.triggers) push(`${row.table_name} ${row.tgname}`)
  push('')
  push('## policies')
  for (const row of inventory.policies) push(`${row.tablename} ${row.policyname} ${row.cmd} ${row.roles}`)
  push('')
  push('## grants anon/authenticated/dinamic_api/service_role')
  for (const row of inventory.grants) push(`${row.table_name} ${row.grantee} ${row.privilege_type}`)
  return redact(lines.join('\n') + '\n')
}
