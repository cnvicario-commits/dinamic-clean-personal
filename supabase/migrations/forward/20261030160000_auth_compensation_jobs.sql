-- Durable record when an Auth user was created and deleting it failed.
-- Not applied to production by this change.

create table if not exists public.auth_compensation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type = 'delete_orphan_auth_user'),
  auth_user_id uuid not null,
  status text not null check (status in ('pending', 'succeeded', 'exhausted')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists auth_compensation_jobs_one_pending_user
  on public.auth_compensation_jobs (auth_user_id)
  where status = 'pending';

alter table public.auth_compensation_jobs enable row level security;

revoke all on table public.auth_compensation_jobs from anon, authenticated;
grant select, insert, update on table public.auth_compensation_jobs to dinamic_api;

drop policy if exists auth_compensation_jobs_dinamic_api_all on public.auth_compensation_jobs;
create policy auth_compensation_jobs_dinamic_api_all
  on public.auth_compensation_jobs
  for all
  to dinamic_api
  using (true)
  with check (true);
