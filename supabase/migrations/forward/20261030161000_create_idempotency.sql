-- Replay protection for client create and purchase-request create.
-- A repeated key with the same payload returns the stored row.
-- A repeated key with a different payload conflicts.
-- Not applied to production by this change.

create table if not exists public.client_operation_idempotency (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation = 'client_create'),
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  payload_hash text not null,
  status text not null check (status in ('PROCESSING', 'COMPLETED')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key)
);

alter table public.client_operation_idempotency enable row level security;
revoke all on table public.client_operation_idempotency from anon, authenticated;
grant select, insert, update, delete on table public.client_operation_idempotency to dinamic_api;

drop policy if exists client_operation_idempotency_dinamic_api_all on public.client_operation_idempotency;
create policy client_operation_idempotency_dinamic_api_all
  on public.client_operation_idempotency
  for all
  to dinamic_api
  using (true)
  with check (true);

alter table public.purchase_operation_idempotency
  drop constraint if exists purchase_operation_idempotency_operation_check;

alter table public.purchase_operation_idempotency
  add constraint purchase_operation_idempotency_operation_check
  check (operation in ('purchase_request_import', 'purchase_order_generate', 'purchase_request_create'));
