import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Env } from '../../config/env.js'
import { AppError, badRequest, conflict, notFound, serviceUnavailable } from '../../http/errors/app-error.js'

export type AuthUserSummary = {
  id: string
  email: string | null
}

/** Lifecycle status derived from Supabase Auth (source of truth for ACTIVE/DISABLED). */
export type AuthUserLifecycleStatus = 'ACTIVE' | 'DISABLED' | 'DELETED'

/**
 * Session invalidation uses Option C: Auth `app_metadata.tokens_valid_after`.
 *
 * Supabase Admin `signOut(jwt, scope)` requires a user JWT — there is NO documented
 * revoke-by-user-id API. Do not call signOut(userId).
 *
 * Access tokens with `iat` before `tokens_valid_after` are rejected server-side.
 * Refresh-token deletion-by-user-id is NOT claimed as supported.
 */
export type AuthUserSecurityState = {
  id: string
  email: string | null
  status: AuthUserLifecycleStatus
  bannedUntil: string | null
  /** ISO timestamp; access JWTs with iat < this are rejected. */
  tokensValidAfter: string | null
}

export type IdentityAdmin = {
  createAuthUser(input: { email: string; password: string }): Promise<AuthUserSummary>
  deleteAuthUser(userId: string): Promise<void>
  setAuthPassword(userId: string, password: string): Promise<void>
  listAuthEmails(): Promise<Map<string, string | null>>
  banAuthUser(userId: string): Promise<void>
  unbanAuthUser(userId: string): Promise<void>
  getAuthUserSecurityState(userId: string): Promise<AuthUserSecurityState>
  /**
   * Bump `app_metadata.tokens_valid_after` to now (documented Admin updateUserById).
   * Invalidates previously issued access tokens at request-time checks.
   */
  invalidateAccessTokens(userId: string): Promise<void>
  listAuthUserSecurityStates(): Promise<Map<string, AuthUserSecurityState>>
}

/** ~100 years — durable disable without DELETE. */
export const DISABLE_BAN_DURATION = '876000h'

export const TOKENS_VALID_AFTER_META_KEY = 'tokens_valid_after'

function requireServiceRole(env: Env): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw serviceUnavailable('Identity dependency unavailable')
  }
  return env.SUPABASE_SERVICE_ROLE_KEY
}

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

function readTokensValidAfter(user: User): string | null {
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>
  const raw = meta[TOKENS_VALID_AFTER_META_KEY]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
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
    tokensValidAfter: readTokensValidAfter(user),
  }
}

/**
 * Fail-closed when an invalidation epoch is set but JWT lacks usable `iat`,
 * or when `iat` is at/before the epoch second (Option A — strict second boundary).
 *
 * JWT `iat` is second-precision. A login in the same second as invalidation may
 * still be rejected; clients should retry in the next second. Prefer this over
 * inventing a custom claim that Auth does not emit.
 */
export function isAccessTokenInvalidated(
  jwtIatSeconds: unknown,
  tokensValidAfter: string | null,
): boolean {
  if (tokensValidAfter == null) return false
  const cutMs = Date.parse(tokensValidAfter)
  if (Number.isNaN(cutMs)) return true
  if (typeof jwtIatSeconds !== 'number' || !Number.isFinite(jwtIatSeconds)) {
    return true
  }
  const cutSec = Math.floor(cutMs / 1000)
  return jwtIatSeconds <= cutSec
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

  async function bumpTokensValidAfter(userId: string): Promise<void> {
    const { data, error } = await client.auth.admin.getUserById(userId)
    if (error || !data.user) {
      throw mapAuthAdminError(error, 'auth_get_user_failed')
    }
    const existing =
      data.user.app_metadata && typeof data.user.app_metadata === 'object'
        ? { ...(data.user.app_metadata as Record<string, unknown>) }
        : {}
    const { error: updErr } = await client.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existing,
        [TOKENS_VALID_AFTER_META_KEY]: new Date().toISOString(),
      },
    })
    if (updErr) throw mapAuthAdminError(updErr, 'session_invalidation_failed')
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

    async invalidateAccessTokens(userId) {
      await bumpTokensValidAfter(userId)
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
