import type { Db } from '../db/pool.js'
import { isRole, type Role } from '../../domain/rbac.js'
import { AppError, forbidden, unauthorized, userDisabled } from '../../http/errors/app-error.js'
import type { IdentityAdmin } from '../auth/identity-admin.js'

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

export type LoadProfileOptions = {
  /**
   * Preferred Phase 2E path: Auth Admin security state (works when dinamic_api
   * cannot SELECT auth.users). When provided, DB ban probe is skipped.
   */
  identity?: IdentityAdmin | null
}

/**
 * Load profile by auth user id.
 *
 * `public.perfiles` has no `activo` column — ACTIVE/DISABLED SoT is Auth `banned_until`.
 * Role SoT is always `perfiles.rol` (never JWT role claims).
 *
 * Revocation:
 * 1. If `identity` is provided → Auth Admin getUserSecurityState (fail-closed).
 * 2. Else try SELECT auth.users (may work for elevated DB roles).
 * 3. If neither works → residual risk documented (prefer always wiring IdentityAdmin).
 */
export async function loadProfile(
  db: Db,
  userId: string,
  options: LoadProfileOptions = {},
): Promise<LoadedProfile> {
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

  if (options.identity) {
    await assertAuthUserNotRevokedViaIdentity(options.identity, userId)
  } else {
    await assertAuthUserNotRevoked(db, userId)
  }

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

export async function assertAuthUserNotRevokedViaIdentity(
  identity: IdentityAdmin,
  userId: string,
): Promise<void> {
  const state = await identity.getAuthUserSecurityState(userId)
  if (state.status === 'DELETED') {
    throw unauthorized('Auth user deleted')
  }
  if (state.status === 'DISABLED') {
    throw userDisabled('Auth user banned')
  }
}

/**
 * Fail closed when auth.users is queryable and the user is missing, banned, or deleted.
 * If the query fails for access/schema reasons (not an AppError), swallow and proceed —
 * residual risk when IdentityAdmin is not wired.
 */
export async function assertAuthUserNotRevoked(db: Db, userId: string): Promise<void> {
  try {
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
      throw userDisabled('Auth user banned')
    }
  } catch (err) {
    if (err instanceof AppError) throw err
  }
}
