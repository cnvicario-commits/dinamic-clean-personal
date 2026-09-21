import type { IdentityAdmin } from '../../infrastructure/auth/identity-admin.js'
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
  /** Optional logger for compensation failures (no secrets). */
  logOrphan?: (payload: { requestId?: string; authUserId: string }) => void
  /** Structured admin action log (no passwords / JWTs). */
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

function toAdminUser(
  row: ProfileRecord,
  email: string | null,
  disabled: boolean,
): AdminUserResponse {
  if (!isRole(row.rol)) {
    throw badRequest('Profile has invalid role')
  }
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    rol: row.rol,
    email,
    disabled,
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

/** Target is always the authenticated subject — never from body. */
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
    items: rows.map((p) => {
      const state = states.get(p.id)
      return toAdminUser(p, state?.email ?? null, state?.status === 'DISABLED')
    }),
  }
}

export async function getUser(deps: UsersDeps, id: string): Promise<AdminUserResponse> {
  const row = await deps.profiles.getById(id)
  if (!row) {
    throw notFound('User not found')
  }
  const state = await deps.identity.getAuthUserSecurityState(id)
  return toAdminUser(row, state.email, state.status === 'DISABLED')
}

/**
 * Create Auth user then profile. On profile failure: delete Auth user.
 * Compensation failure → 500 user_create_orphan (never success).
 */
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
    return toAdminUser(row, authUser.email, false)
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
 * Role change uses DB `perfiles.rol` immediately (upgrade and downgrade).
 * Old JWT role claims are ignored — authorize() uses request.auth.role from loadProfile.
 * Demoting the last active admin is blocked.
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
  if (demotingAdmin) {
    await assertNotLastActiveAdmin(deps, userId)
  }

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
    await deps.identity.revokeUserSessions(userId)
  } catch (err) {
    deps.logAdminAction?.({
      ...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
      ...(opts?.actorUserId !== undefined ? { actorUserId: opts.actorUserId } : {}),
      targetUserId: userId,
      action: 'set_password_revoke_sessions',
      result: 'error',
    })
    throw err instanceof AppError
      ? err
      : new AppError(502, 'session_revocation_failed', 'Password updated but session revocation failed')
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
 * Disable = Auth ban (banned_until). Idempotent if already DISABLED.
 * Does not change role / password / MFA factors.
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

  const state = await deps.identity.getAuthUserSecurityState(targetUserId)
  if (state.status === 'DELETED') {
    throw conflict('Cannot disable a deleted user')
  }

  if (existing.rol === 'admin' && state.status === 'ACTIVE') {
    await assertNotLastActiveAdmin(deps, targetUserId)
  }

  if (state.status !== 'DISABLED') {
    await deps.identity.banAuthUser(targetUserId)
  }

  try {
    await deps.identity.revokeUserSessions(targetUserId)
  } catch (err) {
    deps.logAdminAction?.({
      ...(actor.requestId !== undefined ? { requestId: actor.requestId } : {}),
      actorUserId: actor.userId,
      targetUserId,
      action: 'disable_revoke_sessions',
      result: 'error',
    })
    // Ban already applied — fail closed for access tokens via security-state check.
    // Surface revocation failure so callers do not assume refresh tokens are dead.
    throw err instanceof AppError
      ? err
      : new AppError(502, 'session_revocation_failed', 'User disabled but session revocation failed')
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
 * Enable = lift Auth ban. Idempotent if already ACTIVE.
 * Does not reset role / password / MFA.
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

/**
 * Ensure at least one other ACTIVE admin remains after disabling/demoting `targetUserId`.
 * Locks admin profile rows when the repository supports FOR UPDATE.
 */
export async function assertNotLastActiveAdmin(
  deps: UsersDeps,
  targetUserId: string,
): Promise<void> {
  await deps.profiles.withAdminProfilesLocked(async (admins) => {
    let activeOthers = 0
    for (const admin of admins) {
      if (admin.id === targetUserId) continue
      const state = await deps.identity.getAuthUserSecurityState(admin.id)
      if (state.status === 'ACTIVE') {
        activeOthers += 1
      }
    }
    if (activeOthers < 1) {
      throw new AppError(
        409,
        'last_admin_protected',
        'Cannot disable or demote the last active admin',
      )
    }
  })
}
