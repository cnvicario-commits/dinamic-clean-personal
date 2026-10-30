import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')

describe('phase 3 forward migrations', () => {
  it('records an Auth compensation job without browser grants', () => {
    const sql = readFileSync(
      resolve(root, 'supabase/migrations/forward/20261030160000_auth_compensation_jobs.sql'),
      'utf8',
    ).toLowerCase()
    expect(sql).toContain('create table if not exists public.auth_compensation_jobs')
    expect(sql).toContain('delete_orphan_auth_user')
    expect(sql).toContain('where status = \'pending\'')
    expect(sql).toContain('revoke all on table public.auth_compensation_jobs from anon, authenticated')
    expect(sql).toContain('grant select, insert, update on table public.auth_compensation_jobs to dinamic_api')
  })

  it('protects client and purchase-request creates with actor-scoped keys', () => {
    const sql = readFileSync(
      resolve(root, 'supabase/migrations/forward/20261030161000_create_idempotency.sql'),
      'utf8',
    ).toLowerCase()
    expect(sql).toContain('primary key (actor_id, operation, idempotency_key)')
    expect(sql).toContain('client_create')
    expect(sql).toContain('purchase_request_create')
    expect(sql).toContain('revoke all on table public.client_operation_idempotency from anon, authenticated')
  })
})
