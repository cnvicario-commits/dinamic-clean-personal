-- Phase 5A CRM: browser reads/mutations close after API migration. Runtime compatibility must be checked before applying.
begin;
-- `updated_at` is the optimistic-concurrency token. The legacy table allowed
-- it to be NULL on insert, which would make a mandatory precondition unusable.
update public.crm_oportunidades set updated_at=created_at where updated_at is null;
alter table public.crm_oportunidades alter column updated_at set default now();
alter table public.crm_oportunidades alter column updated_at set not null;
create table if not exists public.crm_operation_idempotency (
 actor_id uuid not null references auth.users(id) on delete cascade,
 operation text not null check (operation in ('opportunity_create')),
 idempotency_key text not null check (length(idempotency_key) between 1 and 255), payload_hash text not null,
 status text not null check (status in ('PROCESSING','COMPLETED','FAILED')), response jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(actor_id,operation,idempotency_key)
);
alter table public.crm_operation_idempotency enable row level security;
revoke all on public.crm_operation_idempotency from anon, authenticated;
grant select,insert,update,delete on public.crm_operation_idempotency to dinamic_api;
do $$ declare t text; begin foreach t in array array['crm_prospectos','crm_oportunidades','crm_seguimientos','crm_referidores','crm_tipos_cliente','crm_tipos_servicio','crm_vistas'] loop execute format('drop policy if exists %I on public.%I',t||'_authenticated_all',t); execute format('revoke insert,update,delete on public.%I from anon,authenticated',t); execute format('grant select,insert,update,delete on public.%I to dinamic_api',t); execute format('drop policy if exists %I on public.%I',t||'_dinamic_api_all',t); execute format('create policy %I on public.%I for all to dinamic_api using (true) with check (true)',t||'_dinamic_api_all',t); end loop; end $$;
commit;
