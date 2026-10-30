-- A claimed job leaves pending so a second worker cannot select it.
-- updated_at is the last claim or attempt time. last_error_code stores the error class.
-- Not applied to production by this change.

alter table public.auth_compensation_jobs
  drop constraint if exists auth_compensation_jobs_status_check;

alter table public.auth_compensation_jobs
  add constraint auth_compensation_jobs_status_check
  check (status in ('pending', 'processing', 'succeeded', 'exhausted'));
