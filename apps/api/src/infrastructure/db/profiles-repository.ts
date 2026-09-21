import type { Role } from '../../domain/rbac.js'
import type { Db } from '../db/pool.js'
import type pg from 'pg'
import { AppError, conflict, notFound } from '../../http/errors/app-error.js'

export type ProfileRecord = {
  id: string
  nombre_completo: string | null
  rol: string
  created_at?: string
}

/** Transaction-scoped ops that MUST use the lock connection. */
export type AdminLifecycleTx = {
  updateRole(userId: string, rol: Role): Promise<ProfileRecord>
}

export type AdminLifecycleLockContext = {
  admins: ProfileRecord[]
  tx: AdminLifecycleTx
}

/**
 * Profile persistence via the API DB pool (`dinamic_api`).
 *
 * Phase 2D: parameterized SQL only. Service role is NOT used.
 * Requires migration `0001_phase2d_perfiles_hardening.sql` (column grants + RLS).
 * Primary authorization: Fastify `requirePermission` / `authorize`.
 */
export type ProfilesRepository = {
  list(): Promise<ProfileRecord[]>
  getById(id: string): Promise<ProfileRecord | null>
  updateNombreCompleto(userId: string, nombreCompleto: string): Promise<ProfileRecord>
  upsert(input: { id: string; nombreCompleto: string; rol: Role }): Promise<ProfileRecord>
  updateRole(userId: string, rol: Role): Promise<ProfileRecord>
  /**
   * Serialize admin lifecycle across processes via `pg_advisory_xact_lock`.
   * Demotion UPDATEs must use `ctx.tx` (same connection / BEGIN…COMMIT).
   */
  withAdminLifecycleLock<T>(fn: (ctx: AdminLifecycleLockContext) => Promise<T>): Promise<T>
}

/** Prefer PostgreSQL SQLSTATE; message match is fallback only. */
export function mapProfileWriteError(err: unknown): AppError {
  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : undefined

  if (code === '23505') {
    return conflict('Profile already exists')
  }
  if (code === '23503') {
    return new AppError(502, 'profile_write_failed', 'Profile persistence failed')
  }
  if (code === '42501') {
    return new AppError(
      503,
      'profile_write_denied',
      'Profile write denied by database privileges — apply Phase 2D migration and use dinamic_api',
    )
  }

  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  if (/duplicate|unique|already exists/i.test(msg)) {
    return conflict('Profile already exists')
  }
  if (/foreign key|violates/i.test(msg)) {
    return new AppError(502, 'profile_write_failed', 'Profile persistence failed')
  }
  if (/permission denied|row-level security|rls/i.test(msg)) {
    return new AppError(
      503,
      'profile_write_denied',
      'Profile write denied by database privileges — apply Phase 2D migration and use dinamic_api',
    )
  }
  return new AppError(502, 'profile_write_failed', 'Profile persistence failed')
}

/** Shared UPDATE … rol helper for pool query or transactional client. */
type SqlQueryable = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<pg.QueryResult<T>>
}

export async function updateRoleWithClient(
  client: SqlQueryable,
  userId: string,
  rol: Role,
): Promise<ProfileRecord> {
  const result = await client.query<ProfileRecord>(
    `update public.perfiles
     set rol = $2
     where id = $1::uuid
     returning id, nombre_completo, rol, created_at::text as created_at`,
    [userId, rol],
  )
  if (!result.rows[0]) throw notFound('Profile not found')
  return result.rows[0]
}

export function createProfilesRepository(db: Db): ProfilesRepository {
  return {
    async list() {
      const result = await db.query<ProfileRecord>(
        `select id, nombre_completo, rol, created_at::text as created_at
         from public.perfiles
         order by nombre_completo asc nulls last`,
      )
      return result.rows
    },

    async getById(id) {
      const result = await db.query<ProfileRecord>(
        `select id, nombre_completo, rol, created_at::text as created_at
         from public.perfiles
         where id = $1::uuid
         limit 1`,
        [id],
      )
      return result.rows[0] ?? null
    },

    async updateNombreCompleto(userId, nombreCompleto) {
      try {
        const result = await db.query<ProfileRecord>(
          `update public.perfiles
           set nombre_completo = $2
           where id = $1::uuid
           returning id, nombre_completo, rol, created_at::text as created_at`,
          [userId, nombreCompleto],
        )
        if (!result.rows[0]) throw notFound('Profile not found')
        return result.rows[0]
      } catch (err) {
        if (err instanceof AppError) throw err
        throw mapProfileWriteError(err)
      }
    },

    async upsert({ id, nombreCompleto, rol }) {
      try {
        const result = await db.query<ProfileRecord>(
          `insert into public.perfiles (id, nombre_completo, rol)
           values ($1::uuid, $2, $3)
           on conflict (id) do update
             set nombre_completo = excluded.nombre_completo,
                 rol = excluded.rol
           returning id, nombre_completo, rol, created_at::text as created_at`,
          [id, nombreCompleto, rol],
        )
        if (!result.rows[0]) {
          throw new AppError(500, 'profile_upsert_empty', 'Profile upsert returned no row')
        }
        return result.rows[0]
      } catch (err) {
        if (err instanceof AppError) throw err
        throw mapProfileWriteError(err)
      }
    },

    async updateRole(userId, rol) {
      try {
        return await updateRoleWithClient(db, userId, rol)
      } catch (err) {
        if (err instanceof AppError) throw err
        throw mapProfileWriteError(err)
      }
    },

    async withAdminLifecycleLock(fn) {
      // Stable key for Phase 2E admin lifecycle serialization (not a secret).
      const ADMIN_LIFECYCLE_LOCK_KEY = 872_014_201
      const client = await db.pool.connect()
      try {
        await client.query('begin')
        await client.query('select pg_advisory_xact_lock($1)', [ADMIN_LIFECYCLE_LOCK_KEY])
        const result = await client.query<ProfileRecord>(
          `select id, nombre_completo, rol, created_at::text as created_at
           from public.perfiles
           where rol = 'admin'
           order by id
           for update`,
        )
        const tx: AdminLifecycleTx = {
          async updateRole(userId, rol) {
            try {
              return await updateRoleWithClient(client, userId, rol)
            } catch (err) {
              if (err instanceof AppError) throw err
              throw mapProfileWriteError(err)
            }
          },
        }
        const value = await fn({ admins: result.rows, tx })
        await client.query('commit')
        return value
      } catch (err) {
        try {
          await client.query('rollback')
        } catch {
          // ignore rollback errors — lock released with transaction end
        }
        throw err
      } finally {
        client.release()
      }
    },
  }
}
