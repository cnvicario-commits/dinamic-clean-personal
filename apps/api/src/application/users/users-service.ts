import type { IdentityAdmin, AuthUserSecurityState } from '../../infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../../infrastructure/db/profiles-repository.js'
import type { Role } from '../../domain/rbac.js'
import { badRequest, notFound, conflict, forbidden, AppError } from '../../http/errors/app-error.js'
import {
  changeUserRoleBodySchema,
  createUserBodySchema,
  setUserPasswordBodySchema,
  updateOwnProfileBodySchema,
  userIdParamSchema,
  type AdminUserResponse,
  type AdminUserLifecycleStatus,
  type ChangeUserRoleBody,
  type CreateUserBody,
  type MeResponse,
  type ProfileResponse,
  type SetUserPasswordBody,
  type UpdateOwnProfileBody,
  type UsersListResponse,
} from '../../http/schemas/users.js'
import { isRole, permissionsFor } from '../../domain/rbac.js'
import type { AuthContext } from '../../domain/auth-context.js'
import type { LoadedProfile } from '../../infrastructure/db/profiles-repo.js'

export type UsersDeps = {
  identity: IdentityAdmin
  profiles: ProfilesRepository
  logOrphan?: (payload: { requestId?: string; authUserId: string }) => void
  logAdminAction?: (payload: {
    requestId?: string
    actorUserId?: string
    targetUserId: string
    action: string
    result: 'ok' | 'error'
  }) => void
}

export function parseUpdateOwnProfileBody(body: unknown): UpdateOwnProfileBody {
  const parsed = updateOwnProfileBodySchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('Invalid profile update', parsed.error.flatten())
  }
  return parsed.data
}

export function parseCreateUserBody(body: unknown): CreateUserBody {
  const parsed = createUserBodySchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('Invalid create user payload', parsed.error.flatten())
  }
  return parsed.data
}

export function parseChangeUserRoleBody(body: unknown): ChangeUserRoleBody {
  const parsed = changeUserRoleBodySchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('Invalid change role payload', parsed.error.flatten())
  }
  return parsed.data
}

export function parseSetUserPasswordBody(body: unknown): SetUserPasswordBody {
  const parsed = setUserPasswordBodySchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('Invalid set password payload', parsed.error.flatten())
  }
  return parsed.data
}

export function parseUserIdParam(id: string): string {
  const parsed = userIdParamSchema.safeParse(id)
  if (!parsed.success) {
    throw badRequest('Invalid user id')
  }
  return parsed.data
}

function toProfileResponse(row: ProfileRecord): ProfileResponse {
  if (!isRole(row.rol)) {
    throw badRequest('Profile has invalid role')
  }
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    rol: row.rol,
  }
}

function lifecycleFromState(
  state: AuthUserSecurityState | undefined,
): { status: AdminUserLifecycleStatus; disabled: boolean; email: string | null } {
  if (!state) {
    return { status: 'MISSING_AUTH', disabled: false, email: null }
  }
  if (state.status === 'DISABLED') {
    return { status: 'DISABLED', disabled: true, email: state.email }
  }
  if (state.status === 'DELETED') {
    return { status: 'MISSING_AUTH', disabled: false, email: state.email }
  }
  return { status: 'ACTIVE', disabled: false, email: state.email }
}

function toAdminUser(
  row: ProfileRecord,
  state: AuthUserSecurityState | undefined,
): AdminUserResponse {
  if (!isRole(row.rol)) {
    throw badRequest('Profile has invalid role')
  }
  const life = lifecycleFromState(state)
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    rol: row.rol,
    email: life.email,
    status: life.status,
    disabled: life.disabled,
  }
}

export async function buildMeResponse(
  auth: AuthContext,
  profile: LoadedProfile,
): Promise<MeResponse> {
  return {
    userId: auth.userId,
    profileId: auth.profileId,
    role: auth.role,
    email: auth.email,
    nombreCompleto: profile.nombreCompleto,
    permissions: [...permissionsFor(auth.role)],
  }
}

export async function updateOwnProfile(
  profiles: ProfilesRepository,
  userId: string,
  input: UpdateOwnProfileBody,
): Promise<ProfileResponse> {
  const row = await profiles.updateNombreCompleto(userId, input.nombreCompleto)
  return toProfileResponse(row)
}

export async function listUsers(deps: UsersDeps): Promise<UsersListResponse> {
  const [rows, states] = await Promise.all([
    deps.profiles.list(),
    deps.identity.listAuthUserSecurityStates(),
  ])
  return {
    items: rows.map((p) => toAdminUser(p, states.get(p.id))),
  }
}

export async function getUser(deps: UsersDeps, id: string): Promise<AdminUserResponse> {
  const row = await deps.profiles.getById(id)
  if (!row) {
    throw notFound('User not found')
  }
  let state: AuthUserSecurityState | undefined
  try {
    state = await deps.identity.getAuthUserSecurityState(id)
  } catch (err) {
    if (err instanceof AppError && err.status === 404) {
      state = undefined
    } else {
      throw err
    }
  }
  return toAdminUser(row, state)
}

export async function createUser(
  deps: UsersDeps,
  input: CreateUserBody,
  opts?: { requestId?: string },
): Promise<AdminUserResponse> {
  const authUser = await deps.identity.createAuthUser({
    email: input.email,
    password: input.password,
  })

  try {
    const row = await deps.profiles.upsert({
      id: authUser.id,
      nombreCompleto: input.nombreCompleto,
      rol: input.rol,
    })
    return toAdminUser(row, {
      id: authUser.id,
      email: authUser.email,
      status: 'ACTIVE',
      bannedUntil: null,
      tokensValidAfter: null,
    })
  } catch (err) {
    try {
      await deps.identity.deleteAuthUser(authUser.id)
    } catch (compensateErr) {
      deps.logOrphan?.({
        ...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
        authUserId: authUser.id,
      })
      throw new AppError(
        500,
        'user_create_orphan',
        'User create incomplete; manual reconciliation required',
        {
          authUserId: authUser.id,
          requestId: opts?.requestId,
          profileFailed: true,
          compensateFailed: true,
          profileErrorCode: err instanceof AppError ? err.code : 'unknown',
          compensateErrorCode:
            compensateErr instanceof AppError ? compensateErr.code : 'unknown',
        },
      )
    }
    throw err
  }
}

/**
 * Role SoT = perfiles.rol (immediate upgrade and downgrade).
 * JWT role claims are ignored. Demote of last ACTIVE admin is blocked under advisory lock.
 */
export async function changeUserRole(
  deps: UsersDeps,
  userId: string,
  rol: Role,
  opts?: { actorUserId?: string; requestId?: string },
): Promise<ProfileResponse> {
  const existing = await deps.profiles.getById(userId)
  if (!existing) {
    throw notFound('User not found')
  }

  const demotingAdmin = existing.rol === 'admin' && rol !== 'admin'
  if (!demotingAdmin) {
    const row = await deps.profiles.updateRole(userId, rol)
    deps.logAdminAction?.({
      ...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
      ...(opts?.actorUserId !== undefined ? { actorUserId: opts.actorUserId } : {}),
      targetUserId: userId,
      action: 'change_role',
      result: 'ok',
    })
    return toProfileResponse(row)
  }

  const row = await deps.profiles.withAdminLifecycleLock(async ({ admins, tx }) => {
    await assertNotLastActiveAdminLocked(deps, admins, userId)
    return tx.updateRole(userId, rol)
  })

  deps.logAdminAction?.({
    ...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
    ...(opts?.actorUserId !== undefined ? { actorUserId: opts.actorUserId } : {}),
    targetUserId: userId,
    action: 'change_role',
    result: 'ok',
  })
  return toProfileResponse(row)
}

export async function setUserPassword(
  deps: UsersDeps,
  userId: string,
  password: string,
  opts?: { actorUserId?: string; requestId?: string },
): Promise<void> {
  const existing = await deps.profiles.getById(userId)
  if (!existing) {
    throw notFound('User not found')
  }
  await deps.identity.setAuthPassword(userId, password)
  try {
    await deps.identity.invalidateAccessTokens(userId)
  } catch {
    deps.logAdminAction?.({
      ...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
      ...(opts?.actorUserId !== undefined ? { actorUserId: opts.actorUserId } : {}),
      targetUserId: userId,
      action: 'set_password_invalidate_tokens',
      result: 'error',
    })
    throw new AppError(
      502,
      'password_changed_session_invalidation_failed',
      'Password updated but access-token invalidation failed',
      {
        password_changed: true,
        session_invalidation: 'failed',
      },
    )
  }
  deps.logAdminAction?.({
    ...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
    ...(opts?.actorUserId !== undefined ? { actorUserId: opts.actorUserId } : {}),
    targetUserId: userId,
    action: 'set_password',
    result: 'ok',
  })
}

export type LifecycleActor = {
  userId: string
  requestId?: string
}

/**
 * Disable = Auth ban + bump tokens_valid_after (Option C).
 * Enable does NOT clear tokens_valid_after → pre-disable access tokens stay dead.
 * Refresh revoke-by-user-id is unsupported by Supabase Admin SDK — not claimed here.
 */
export async function disableUser(
  deps: UsersDeps,
  targetUserId: string,
  actor: LifecycleActor,
): Promise<void> {
  if (actor.userId === targetUserId) {
    throw forbidden('Cannot disable your own account')
  }

  const existing = await deps.profiles.getById(targetUserId)
  if (!existing) {
    throw notFound('User not found')
  }

  const runBanAndInvalidate = async (state: Awaited<
    ReturnType<IdentityAdmin['getAuthUserSecurityState']>
  >) => {
    if (state.status === 'DELETED') {
      throw conflict('Cannot disable a deleted user')
    }
    if (state.status !== 'DISABLED') {
      await deps.identity.banAuthUser(targetUserId)
    }
    try {
      await deps.identity.invalidateAccessTokens(targetUserId)
    } catch {
      throw new AppError(
        502,
        'user_disabled_session_invalidation_failed',
        'User banned but access-token invalidation failed',
        {
          banned: true,
          session_invalidation: 'failed',
        },
      )
    }
  }

  if (existing.rol === 'admin') {
    await deps.profiles.withAdminLifecycleLock(async ({ admins }) => {
      const state = await deps.identity.getAuthUserSecurityState(targetUserId)
      if (state.status === 'ACTIVE') {
        await assertNotLastActiveAdminLocked(deps, admins, targetUserId)
      }
      await runBanAndInvalidate(state)
    })
  } else {
    const state = await deps.identity.getAuthUserSecurityState(targetUserId)
    await runBanAndInvalidate(state)
  }

  deps.logAdminAction?.({
    ...(actor.requestId !== undefined ? { requestId: actor.requestId } : {}),
    actorUserId: actor.userId,
    targetUserId,
    action: 'disable',
    result: 'ok',
  })
}

/**
 * Enable = lift Auth ban only. Does not reset role/password/MFA.
 * Does not clear tokens_valid_after → pre-disable access JWTs stay dead.
 *
 * Refresh semantics (Option B — honest Supabase limitation):
 * There is no documented Admin revoke-by-user-id. After enable, a pre-disable
 * refresh token MAY mint a new access token. That new access token is allowed
 * only if its `iat` is after `tokens_valid_after`. Pre-disable access JWTs
 * remain rejected. Do not claim "fresh password login required" for refresh.
 */
export async function enableUser(
  deps: UsersDeps,
  targetUserId: string,
  actor: LifecycleActor,
): Promise<void> {
  const existing = await deps.profiles.getById(targetUserId)
  if (!existing) {
    throw notFound('User not found')
  }

  const state = await deps.identity.getAuthUserSecurityState(targetUserId)
  if (state.status === 'DELETED') {
    throw conflict('Cannot enable a deleted user')
  }

  if (state.status === 'DISABLED') {
    await deps.identity.unbanAuthUser(targetUserId)
  }

  deps.logAdminAction?.({
    ...(actor.requestId !== undefined ? { requestId: actor.requestId } : {}),
    actorUserId: actor.userId,
    targetUserId,
    action: 'enable',
    result: 'ok',
  })
}

/** Must run inside withAdminLifecycleLock critical section. */
export async function assertNotLastActiveAdminLocked(
  deps: UsersDeps,
  admins: ProfileRecord[],
  targetUserId: string,
): Promise<void> {
  // Early-exit: one other ACTIVE admin is enough. Avoids N Auth lookups when many rows exist.
  for (const admin of admins) {
    if (admin.id === targetUserId) continue
    const state = await deps.identity.getAuthUserSecurityState(admin.id)
    if (state.status === 'ACTIVE') {
      return
    }
  }
  throw new AppError(
    409,
    'last_admin_protected',
    'Cannot disable or demote the last active admin',
  )
}
