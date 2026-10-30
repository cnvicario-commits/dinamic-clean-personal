-- Lost response on POST /v1/companies must not insert a second row.
-- empresas.cuit is not unique and may repeat across real companies, so the
-- protection is the request key, not a unique constraint on CUIT.
-- Not applied to production by this change.

create table if not exists public.company_operation_idempotency (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation = 'company_create'),
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  payload_hash text not null,
  status text not null check (status in ('PROCESSING', 'COMPLETED')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key)
);

alter table public.company_operation_idempotency enable row level security;
revoke all on table public.company_operation_idempotency from anon, authenticated;
grant select, insert, update, delete on table public.company_operation_idempotency to dinamic_api;

drop policy if exists company_operation_idempotency_dinamic_api_all on public.company_operation_idempotency;
create policy company_operation_idempotency_dinamic_api_all
  on public.company_operation_idempotency
  for all
  to dinamic_api
  using (true)
  with check (true);
