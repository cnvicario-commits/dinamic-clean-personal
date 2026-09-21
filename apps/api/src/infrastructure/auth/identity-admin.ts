import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../../config/env.js'
import { AppError, badRequest, conflict, notFound, serviceUnavailable } from '../../http/errors/app-error.js'

export type AuthUserSummary = {
  id: string
  email: string | null
}

/**
 * Auth Admin only (Supabase service role).
 * Profile persistence lives in ProfilesRepository — do not mix concerns here.
 */
export type IdentityAdmin = {
  createAuthUser(input: { email: string; password: string }): Promise<AuthUserSummary>
  deleteAuthUser(userId: string): Promise<void>
  setAuthPassword(userId: string, password: string): Promise<void>
  /** Paginated Auth email lookup. Values may be null when Auth has no email. */
  listAuthEmails(): Promise<Map<string, string | null>>
}

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

export function createIdentityAdmin(env: Env): IdentityAdmin {
  const key = requireServiceRole(env)
  const client: SupabaseClient = createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
      const perPage = 200
      let page = 1
      for (;;) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage })
        if (error) throw mapAuthAdminError(error, 'auth_list_failed')
        const users = data.users ?? []
        for (const u of users) {
          map.set(u.id, u.email ?? null)
        }
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
      return map
    },
  }
}
