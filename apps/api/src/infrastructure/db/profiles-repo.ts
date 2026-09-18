import type { Db } from '../db/pool.js'
import { isRole, type Role } from '../../domain/rbac.js'
import { AppError, forbidden, unauthorized } from '../../http/errors/app-error.js'

export type ProfileRow = {
  id: string
  nombre_completo: string | null
  rol: string
}

export type LoadedProfile = {
  profileId: string
  role: Role
  nombreCompleto: string | null
}

/**
 * Load profile by auth user id.
 *
 * `public.perfiles` has no `activo` column — do not claim an "active" guarantee.
 * Revocation prefers `auth.users` (banned_until / deleted_at) when the DB role can SELECT it.
 *
 * Phase 1 least-privilege role `dinamic_api` intentionally has NO grant on auth.users
 * (see supabase/ops/create_api_role.sql). In that configuration assertAuthUserNotRevoked
 * cannot query bans/deletes and continues — residual risk: a revoked Auth user may still
 * authenticate until JWT expiry if a perfiles row remains. Prefer short JWT TTL + JWKS.
 *
 * If `auth.users` is not readable, this function continues (residual risk — see
 * assertAuthUserNotRevoked). Missing profile still fails closed with 401.
 */
export async function loadProfile(db: Db, userId: string): Promise<LoadedProfile> {
  const result = await db.query<ProfileRow>(
    `select id, nombre_completo, rol
     from public.perfiles
     where id = $1
     limit 1`,
    [userId],
  )
  const row = result.rows[0]
  if (!row) {
    throw unauthorized('Profile not found')
  }

  await assertAuthUserNotRevoked(db, userId)

  if (!isRole(row.rol)) {
    throw forbidden('Unknown role')
  }
  return {
    profileId: row.id,
    role: row.rol,
    nombreCompleto: row.nombre_completo,
  }
}

type AuthUserRevocationRow = {
  banned_until: Date | string | null
  deleted_at: Date | string | null
}

/**
 * Fail closed when auth.users is queryable and the user is missing, banned, or deleted.
 * If the query fails for access/schema reasons (not an AppError), swallow and proceed —
 * residual risk: JWT + perfiles row may still authenticate without server-side ban check.
 */
export async function assertAuthUserNotRevoked(db: Db, userId: string): Promise<void> {
  try {
    // to_jsonb avoids hard dependency on deleted_at column existence across Supabase versions.
    const result = await db.query<AuthUserRevocationRow>(
      `select
         u.banned_until,
         nullif(to_jsonb(u)->>'deleted_at', '')::timestamptz as deleted_at
       from auth.users u
       where u.id = $1::uuid
       limit 1`,
      [userId],
    )

    const authRow = result.rows[0]
    if (!authRow) {
      throw unauthorized('Auth user not found')
    }
    if (authRow.deleted_at != null) {
      throw unauthorized('Auth user deleted')
    }
    if (authRow.banned_until != null && new Date(authRow.banned_until).getTime() > Date.now()) {
      throw unauthorized('Auth user banned')
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    // Not detectable / not accessible — residual risk documented in loadProfile JSDoc.
  }
}
