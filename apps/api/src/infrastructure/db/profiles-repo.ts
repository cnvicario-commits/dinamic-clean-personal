import type { Db } from '../db/pool.js'
import { isRole, type Role } from '../../domain/rbac.js'
import {
  AppError,
  forbidden,
  sessionInvalidated,
  unauthorized,
  userDisabled,
} from '../../http/errors/app-error.js'
import {
  isAccessTokenInvalidated,
  type IdentityAdmin,
} from '../auth/identity-admin.js'

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
  identity?: IdentityAdmin | null
  /** JWT `iat` (seconds). Required for tokens_valid_after enforcement when identity is wired. */
  jwtIat?: unknown
}

/**
 * Load profile by auth user id.
 *
 * Role SoT = `perfiles.rol`. ACTIVE/DISABLED SoT = Auth `banned_until`.
 * Access-token invalidation SoT = Auth `app_metadata.tokens_valid_after` (Option C).
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
    await assertAuthUserNotRevokedViaIdentity(options.identity, userId, options.jwtIat)
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
  jwtIat?: unknown,
): Promise<void> {
  const state = await identity.getAuthUserSecurityState(userId)
  if (state.status === 'DELETED') {
    throw unauthorized('Auth user deleted')
  }
  if (state.status === 'DISABLED') {
    throw userDisabled('Auth user banned')
  }
  if (isAccessTokenInvalidated(jwtIat, state.tokensValidAfter)) {
    throw sessionInvalidated('Access token invalidated')
  }
}

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
