import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../../config/env.js'
import type { Role } from '../../domain/rbac.js'
import type { Db } from '../db/pool.js'
import { AppError, conflict, notFound, serviceUnavailable } from '../../http/errors/app-error.js'

export type ProfileRecord = {
  id: string
  nombre_completo: string | null
  rol: string
  created_at?: string
}

/**
 * Profile persistence.
 *
 * Reads use the API DB pool (`dinamic_api` SELECT).
 * Writes use the service-role client because `perfiles` RLS has no UPDATE/INSERT
 * policies for authenticated/app roles — pool UPDATEs would be denied.
 * (Closing that gap is Phase 2D; do not expand dinamic_api BYPASSRLS here.)
 */
export type ProfilesRepository = {
  list(): Promise<ProfileRecord[]>
  getById(id: string): Promise<ProfileRecord | null>
  updateNombreCompleto(userId: string, nombreCompleto: string): Promise<ProfileRecord>
  upsert(input: { id: string; nombreCompleto: string; rol: Role }): Promise<ProfileRecord>
  updateRole(userId: string, rol: Role): Promise<ProfileRecord>
}

function requireServiceRole(env: Env): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw serviceUnavailable('Identity dependency unavailable')
  }
  return env.SUPABASE_SERVICE_ROLE_KEY
}

function mapProfileWriteError(err: { message?: string } | null | undefined): AppError {
  const msg = (err?.message ?? '').toLowerCase()
  if (/duplicate|unique|already exists/i.test(msg)) {
    return conflict('Profile already exists')
  }
  if (/foreign key|violates/i.test(msg)) {
    return new AppError(502, 'profile_write_failed', 'Profile persistence failed')
  }
  return new AppError(502, 'profile_write_failed', 'Profile persistence failed')
}

export function createProfilesRepository(env: Env, db: Db): ProfilesRepository {
  const key = requireServiceRole(env)
  const writer: SupabaseClient = createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
      // Explicit allowlisted column only — never spread client body.
      const { data, error } = await writer
        .from('perfiles')
        .update({ nombre_completo: nombreCompleto })
        .eq('id', userId)
        .select('id, nombre_completo, rol, created_at')
        .maybeSingle()
      if (error) throw mapProfileWriteError(error)
      if (!data) throw notFound('Profile not found')
      return data as ProfileRecord
    },

    async upsert({ id, nombreCompleto, rol }) {
      const { data, error } = await writer
        .from('perfiles')
        .upsert({ id, nombre_completo: nombreCompleto, rol })
        .select('id, nombre_completo, rol, created_at')
        .maybeSingle()
      if (error) throw mapProfileWriteError(error)
      if (!data) throw new AppError(500, 'profile_upsert_empty', 'Profile upsert returned no row')
      return data as ProfileRecord
    },

    async updateRole(userId, rol) {
      const { data, error } = await writer
        .from('perfiles')
        .update({ rol })
        .eq('id', userId)
        .select('id, nombre_completo, rol, created_at')
        .maybeSingle()
      if (error) throw mapProfileWriteError(error)
      if (!data) throw notFound('Profile not found')
      return data as ProfileRecord
    },
  }
}
