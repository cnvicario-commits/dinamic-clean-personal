import { z } from 'zod'
import { ROLES } from '../../domain/rbac.js'

const roleSchema = z.enum(ROLES)

/** PATCH /v1/me — only SELF_EDITABLE field. Reject unknown/privileged keys. */
export const updateOwnProfileBodySchema = z
  .object({
    nombreCompleto: z.string().trim().min(1).max(200),
  })
  .strict()

export type UpdateOwnProfileBody = z.infer<typeof updateOwnProfileBodySchema>

/** POST /v1/users */
export const createUserBodySchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(6).max(200),
    nombreCompleto: z.string().trim().min(1).max(200),
    rol: roleSchema,
  })
  .strict()

export type CreateUserBody = z.infer<typeof createUserBodySchema>

/** PATCH /v1/users/:id/role */
export const changeUserRoleBodySchema = z
  .object({
    rol: roleSchema,
  })
  .strict()

export type ChangeUserRoleBody = z.infer<typeof changeUserRoleBodySchema>

/** POST /v1/users/:id/password */
export const setUserPasswordBodySchema = z
  .object({
    password: z.string().min(6).max(200),
  })
  .strict()

export type SetUserPasswordBody = z.infer<typeof setUserPasswordBodySchema>

export const userIdParamSchema = z.string().uuid()

/** Basic profile (e.g. PATCH /me response) — no admin email requirement. */
export const profileResponseSchema = z.object({
  id: z.string().uuid(),
  nombreCompleto: z.string().nullable(),
  rol: roleSchema,
})

/**
 * Admin user list/detail DTO.
 * `email` is required (nullable when Auth has no email) — never omit to hide lookup failure.
 */
export const adminUserResponseSchema = z.object({
  id: z.string().uuid(),
  nombreCompleto: z.string().nullable(),
  rol: roleSchema,
  email: z.string().nullable(),
})

export const usersListResponseSchema = z.object({
  items: z.array(adminUserResponseSchema),
})

export const meResponseSchema = z.object({
  userId: z.string().uuid(),
  profileId: z.string().uuid(),
  role: roleSchema,
  email: z.string().nullable(),
  nombreCompleto: z.string().nullable(),
  permissions: z.array(z.string()),
})

export type MeResponse = z.infer<typeof meResponseSchema>
export type ProfileResponse = z.infer<typeof profileResponseSchema>
export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>
export type UsersListResponse = z.infer<typeof usersListResponseSchema>
