-- Phase 5B Audits: apply only after DB compatibility validation against approved runtime.
begin;
update public.auditoria_planificaciones set updated_at=created_at where updated_at is null;
alter table public.auditoria_planificaciones alter column updated_at set default now();
alter table public.auditoria_planificaciones alter column updated_at set not null;
update public.auditoria_plan_accion set updated_at=created_at where updated_at is null;
alter table public.auditoria_plan_accion alter column updated_at set default now();
alter table public.auditoria_plan_accion alter column updated_at set not null;
create table if not exists public.audits_operation_idempotency (
 actor_id uuid not null references auth.users(id) on delete cascade,
 operation text not null check(operation in ('audit_submit')),
 idempotency_key text not null check(length(idempotency_key) between 1 and 255),
 payload_hash text not null,status text not null check(status in ('PROCESSING','COMPLETED')),response jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(actor_id,operation,idempotency_key)
);
alter table public.audits_operation_idempotency enable row level security;
revoke all on public.audits_operation_idempotency from anon,authenticated;
grant select,insert,update,delete on public.audits_operation_idempotency to dinamic_api;
do $$ declare t text; begin foreach t in array array['auditoria_planificaciones','auditorias','auditoria_respuestas','auditoria_checklist_plantillas','auditoria_checklist_items','auditoria_plan_accion'] loop execute format('drop policy if exists %I on public.%I',t||'_authenticated_all',t);execute format('revoke insert,update,delete on public.%I from anon,authenticated',t);execute format('grant select,insert,update,delete on public.%I to dinamic_api',t);execute format('drop policy if exists %I on public.%I',t||'_dinamic_api_all',t);execute format('create policy %I on public.%I for all to dinamic_api using (true) with check (true)',t||'_dinamic_api_all',t);end loop;end $$;
commit;
