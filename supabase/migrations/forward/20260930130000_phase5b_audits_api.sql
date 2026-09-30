-- Phase 5B Audits — additive schema (backward-compatible).
-- Apply after DB compatibility validation against approved Development/Test.
-- Safe while a legacy PostgREST frontend still exists:
--   - does NOT revoke browser grants/policies
--   - DOES grant dinamic_api so the new API can run in parallel
begin;

-- Reuse shared trigger function from baseline (do not create a private copy).
do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() is required before Phase 5B audits additive migration';
  end if;
end $$;

grant usage on schema public to dinamic_api;

-- Optimistic concurrency tokens for planning / action rows.
update public.auditoria_planificaciones set updated_at = created_at where updated_at is null;
alter table public.auditoria_planificaciones alter column updated_at set default now();
alter table public.auditoria_planificaciones alter column updated_at set not null;

update public.auditoria_plan_accion set updated_at = created_at where updated_at is null;
alter table public.auditoria_plan_accion alter column updated_at set default now();
alter table public.auditoria_plan_accion alter column updated_at set not null;

-- Checklist plantillas need updated_at for optimistic concurrency on edit/activate.
alter table public.auditoria_checklist_plantillas
  add column if not exists updated_at timestamptz;

update public.auditoria_checklist_plantillas
set updated_at = created_at
where updated_at is null;

alter table public.auditoria_checklist_plantillas
  alter column updated_at set default now();

alter table public.auditoria_checklist_plantillas
  alter column updated_at set not null;

drop trigger if exists trg_auditoria_checklist_plantillas_updated_at
  on public.auditoria_checklist_plantillas;

create trigger trg_auditoria_checklist_plantillas_updated_at
before update on public.auditoria_checklist_plantillas
for each row execute function public.set_updated_at();

-- Idempotency for submit + checklist copy (widen check safely for existing installs).
create table if not exists public.audits_operation_idempotency (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('audit_submit', 'audit_checklist_copy')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  payload_hash text not null,
  status text not null check (status in ('PROCESSING', 'COMPLETED')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key)
);

do $$
declare
  cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.audits_operation_idempotency'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%operation%'
    and pg_get_constraintdef(c.oid) not ilike '%audit_checklist_copy%';

  if cname is not null then
    execute format('alter table public.audits_operation_idempotency drop constraint %I', cname);
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.audits_operation_idempotency'::regclass
      and c.conname = 'audits_operation_idempotency_operation_check'
  ) then
    alter table public.audits_operation_idempotency
      add constraint audits_operation_idempotency_operation_check
      check (operation in ('audit_submit', 'audit_checklist_copy'));
  end if;
end $$;

alter table public.audits_operation_idempotency enable row level security;
revoke all on public.audits_operation_idempotency from anon, authenticated;
grant select, insert, update, delete on public.audits_operation_idempotency to dinamic_api;
drop policy if exists audits_operation_idempotency_dinamic_api_all on public.audits_operation_idempotency;
create policy audits_operation_idempotency_dinamic_api_all
  on public.audits_operation_idempotency
  for all to dinamic_api
  using (true)
  with check (true);

-- Backend can operate while legacy browser policies remain in place.
do $$
declare
  t text;
begin
  foreach t in array array[
    'auditoria_planificaciones',
    'auditorias',
    'auditoria_respuestas',
    'auditoria_checklist_plantillas',
    'auditoria_checklist_items',
    'auditoria_plan_accion'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to dinamic_api', t);
    execute format('drop policy if exists %I on public.%I', t || '_dinamic_api_all', t);
    execute format(
      'create policy %I on public.%I for all to dinamic_api using (true) with check (true)',
      t || '_dinamic_api_all',
      t
    );
  end loop;
end $$;

commit;
