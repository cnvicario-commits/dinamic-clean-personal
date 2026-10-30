import type { Db } from './pool.js'

export type AuthCompensationJob = {
  id: string
  authUserId: string
  attempts: number
}

export type AuthCompensationRepository = {
  recordPending(authUserId: string): Promise<void>
  claimPending(limit: number): Promise<AuthCompensationJob[]>
  mark(id: string, status: 'pending' | 'succeeded' | 'exhausted', errorCode: string | null, attempts: number): Promise<void>
}

const MAX_ATTEMPTS = 5

export function createAuthCompensationRepository(db: Db): AuthCompensationRepository {
  return {
    async recordPending(authUserId) {
      await db.query(
        `insert into public.auth_compensation_jobs (job_type, auth_user_id, status)
         values ('delete_orphan_auth_user', $1, 'pending')
         on conflict (auth_user_id) where status = 'pending' do nothing`,
        [authUserId],
      )
    },
    async claimPending(limit) {
      const result = await db.query<{ id: string; auth_user_id: string; attempts: number }>(
        `select id, auth_user_id, attempts
         from public.auth_compensation_jobs
         where status = 'pending' and attempts < $2
         order by created_at
         limit $1`,
        [limit, MAX_ATTEMPTS],
      )
      return result.rows.map((row) => ({
        id: row.id,
        authUserId: row.auth_user_id,
        attempts: row.attempts,
      }))
    },
    async mark(id, status, errorCode, attempts) {
      await db.query(
        `update public.auth_compensation_jobs
         set status = $2, last_error_code = $3, attempts = $4, updated_at = now()
         where id = $1`,
        [id, status, errorCode, attempts],
      )
    },
  }
}
