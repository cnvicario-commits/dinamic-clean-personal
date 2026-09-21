import type { Role } from '../../domain/rbac.js'
import type { Db } from '../db/pool.js'
import { AppError, conflict, notFound } from '../../http/errors/app-error.js'

export type ProfileRecord = {
  id: string
  nombre_completo: string | null
  rol: string
  created_at?: string
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
   * Serialize admin lifecycle (disable/demote) across processes via
   * `pg_advisory_xact_lock`. Holds the transaction open until `fn` completes
   * (including Auth Admin ban) so check+mutation share one critical section.
   */
  withAdminLifecycleLock<T>(
    fn: (admins: ProfileRecord[]) => Promise<T>,
  ): Promise<T>
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
        const result = await db.query<ProfileRecord>(
          `update public.perfiles
           set rol = $2
           where id = $1::uuid
           returning id, nombre_completo, rol, created_at::text as created_at`,
          [userId, rol],
        )
        if (!result.rows[0]) throw notFound('Profile not found')
        return result.rows[0]
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
        const value = await fn(result.rows)
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
