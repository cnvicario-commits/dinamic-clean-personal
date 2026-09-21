import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Env } from '../../config/env.js'
import { AppError, badRequest, conflict, notFound, serviceUnavailable } from '../../http/errors/app-error.js'

export type AuthUserSummary = {
  id: string
  email: string | null
}

/** Lifecycle status derived from Supabase Auth (source of truth for ACTIVE/DISABLED). */
export type AuthUserLifecycleStatus = 'ACTIVE' | 'DISABLED' | 'DELETED'

export type AuthUserSecurityState = {
  id: string
  email: string | null
  status: AuthUserLifecycleStatus
  bannedUntil: string | null
}

/**
 * Auth Admin only (Supabase service role).
 * Profile persistence lives in ProfilesRepository — do not mix concerns here.
 *
 * Disable/enable = ban_duration on auth.users (banned_until).
 * Session revoke = admin.signOut(userId, 'global') — refresh tokens; access JWT still
 * needs request-time security-state check until expiry.
 */
export type IdentityAdmin = {
  createAuthUser(input: { email: string; password: string }): Promise<AuthUserSummary>
  deleteAuthUser(userId: string): Promise<void>
  setAuthPassword(userId: string, password: string): Promise<void>
  /** Paginated Auth email lookup. Values may be null when Auth has no email. */
  listAuthEmails(): Promise<Map<string, string | null>>
  /** Ban user (~100y). Idempotent if already banned. */
  banAuthUser(userId: string): Promise<void>
  /** Lift ban. Idempotent if already active. */
  unbanAuthUser(userId: string): Promise<void>
  /** Current Auth lifecycle state (banned / deleted / active). */
  getAuthUserSecurityState(userId: string): Promise<AuthUserSecurityState>
  /** Revoke refresh sessions globally. Access JWTs remain until expiry. */
  revokeUserSessions(userId: string): Promise<void>
  /** Batch security states for list DTOs (paginated Auth list). */
  listAuthUserSecurityStates(): Promise<Map<string, AuthUserSecurityState>>
}

/** ~100 years — durable disable without DELETE. */
export const DISABLE_BAN_DURATION = '876000h'

function requireServiceRole(env: Env): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw serviceUnavailable('Identity dependency unavailable')
  }
  return env.SUPABASE_SERVICE_ROLE_KEY
}

/** Map Auth Admin errors — never forward raw provider messages that may leak internals. */
export function mapAuthAdminError(
  err: { message?: string } | null | undefined,
  fallbackCode: string,
): AppError {
  const msg = (err?.message ?? '').toLowerCase()
  if (/already.?registered|already.?exists|duplicate|unique/i.test(msg)) {
    return conflict('A user with this email already exists')
  }
  if (/not found|user not found/i.test(msg)) {
    return notFound('User not found')
  }
  if (/password|weak|invalid.?email|email.?address/i.test(msg)) {
    return badRequest('Invalid credentials payload')
  }
  return new AppError(502, fallbackCode, 'Identity provider error')
}

export function securityStateFromAuthUser(user: User): AuthUserSecurityState {
  const rawBan = (user as { banned_until?: string | null }).banned_until
  const bannedUntil =
    typeof rawBan === 'string' && rawBan.length > 0 ? rawBan : null
  const deletedAt = (user as { deleted_at?: string | null }).deleted_at
  const deleted = typeof deletedAt === 'string' && deletedAt.length > 0

  let status: AuthUserLifecycleStatus = 'ACTIVE'
  if (deleted) {
    status = 'DELETED'
  } else if (bannedUntil != null && new Date(bannedUntil).getTime() > Date.now()) {
    status = 'DISABLED'
  }

  return {
    id: user.id,
    email: user.email ?? null,
    status,
    bannedUntil,
  }
}

export function createIdentityAdmin(env: Env): IdentityAdmin {
  const key = requireServiceRole(env)
  const client: SupabaseClient = createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function listAllUsers(): Promise<User[]> {
    const all: User[] = []
    const perPage = 200
    let page = 1
    for (;;) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage })
      if (error) throw mapAuthAdminError(error, 'auth_list_failed')
      const users = data.users ?? []
      all.push(...users)
      if (users.length < perPage) break
      page += 1
      if (page > 100) {
        throw new AppError(
          502,
          'auth_list_truncated',
          'Auth user listing exceeded safe page limit — refine pagination or contact ops',
        )
      }
    }
    return all
  }

  return {
    async createAuthUser({ email, password }) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) {
        throw mapAuthAdminError(error, 'auth_create_failed')
      }
      return { id: data.user.id, email: data.user.email ?? email }
    },

    async deleteAuthUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId)
      if (error) throw mapAuthAdminError(error, 'auth_delete_failed')
    },

    async setAuthPassword(userId, password) {
      const { error } = await client.auth.admin.updateUserById(userId, { password })
      if (error) throw mapAuthAdminError(error, 'auth_password_failed')
    },

    async listAuthEmails() {
      const map = new Map<string, string | null>()
      for (const u of await listAllUsers()) {
        map.set(u.id, u.email ?? null)
      }
      return map
    },

    async banAuthUser(userId) {
      const { error } = await client.auth.admin.updateUserById(userId, {
        ban_duration: DISABLE_BAN_DURATION,
      })
      if (error) throw mapAuthAdminError(error, 'auth_ban_failed')
    },

    async unbanAuthUser(userId) {
      const { error } = await client.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      })
      if (error) throw mapAuthAdminError(error, 'auth_unban_failed')
    },

    async getAuthUserSecurityState(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId)
      if (error || !data.user) {
        throw mapAuthAdminError(error, 'auth_get_user_failed')
      }
      return securityStateFromAuthUser(data.user)
    },

    async revokeUserSessions(userId) {
      const { error } = await client.auth.admin.signOut(userId, 'global')
      if (error) {
        throw mapAuthAdminError(error, 'session_revocation_failed')
      }
    },

    async listAuthUserSecurityStates() {
      const map = new Map<string, AuthUserSecurityState>()
      for (const u of await listAllUsers()) {
        map.set(u.id, securityStateFromAuthUser(u))
      }
      return map
    },
  }
}
