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
      const client = await db.pool.connect()
      try {
        await client.query('begin')
        await client.query(
          `update public.auth_compensation_jobs
           set status = 'pending', updated_at = now()
           where status = 'processing' and updated_at < now() - interval '2 minutes'`,
        )
        const result = await client.query<{ id: string; auth_user_id: string; attempts: number }>(
          `with claimed as (
             select id
             from public.auth_compensation_jobs
             where status = 'pending' and attempts < $2
             order by created_at
             for update skip locked
             limit $1
           )
           update public.auth_compensation_jobs as job
           set status = 'processing', updated_at = now()
           from claimed
           where job.id = claimed.id
           returning job.id, job.auth_user_id, job.attempts`,
          [limit, MAX_ATTEMPTS],
        )
        await client.query('commit')
        return result.rows.map((row) => ({
          id: row.id,
          authUserId: row.auth_user_id,
          attempts: row.attempts,
        }))
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
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
