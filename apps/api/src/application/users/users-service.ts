import type { IdentityAdmin } from '../../infrastructure/auth/identity-admin.js'
import type { ProfilesRepository, ProfileRecord } from '../../infrastructure/db/profiles-repository.js'
import type { Role } from '../../domain/rbac.js'
import { badRequest, notFound, AppError } from '../../http/errors/app-error.js'
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

function toAdminUser(row: ProfileRecord, email: string | null): AdminUserResponse {
  if (!isRole(row.rol)) {
    throw badRequest('Profile has invalid role')
  }
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    rol: row.rol,
    email,
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
  const [rows, emails] = await Promise.all([
    deps.profiles.list(),
    deps.identity.listAuthEmails(),
  ])
  return {
    items: rows.map((p) => toAdminUser(p, emails.get(p.id) ?? null)),
  }
}

export async function getUser(deps: UsersDeps, id: string): Promise<AdminUserResponse> {
  const row = await deps.profiles.getById(id)
  if (!row) {
    throw notFound('User not found')
  }
  const emails = await deps.identity.listAuthEmails()
  return toAdminUser(row, emails.get(row.id) ?? null)
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
    return toAdminUser(row, authUser.email)
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
          // No passwords / no raw provider dumps
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

export async function changeUserRole(
  profiles: ProfilesRepository,
  userId: string,
  rol: Role,
): Promise<ProfileResponse> {
  const row = await profiles.updateRole(userId, rol)
  return toProfileResponse(row)
}

export async function setUserPassword(
  deps: UsersDeps,
  userId: string,
  password: string,
): Promise<void> {
  const existing = await deps.profiles.getById(userId)
  if (!existing) {
    throw notFound('User not found')
  }
  await deps.identity.setAuthPassword(userId, password)
}
