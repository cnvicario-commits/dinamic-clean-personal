-- Phase 5B Audits — closure (PostgREST DML revoke + backend grants/policies).
--
-- Apply ONLY after:
--   1) additive migration 20260930130000_phase5b_audits_api.sql
--   2) backend with Audits API deployed
--   3) frontend API-only deployed
--   4) direct PostgREST .from(auditoria_*) scan = zero
--
-- Final browser policy (explicit):
--   - SELECT: ALLOWED for role authenticated via *_authenticated_select (not ALL)
--   - DML: DENIED (INSERT/UPDATE/DELETE revoked; no write policies for browser)
--   - dinamic_api: ALLOWED (ALL via *_dinamic_api_all)
--   - anon: no DML; no SELECT policy (deny by default under RLS)
begin;

grant usage on schema public to dinamic_api;

grant select, insert, update, delete
  on public.audits_operation_idempotency
  to dinamic_api;

drop policy if exists audits_operation_idempotency_dinamic_api_all
  on public.audits_operation_idempotency;
create policy audits_operation_idempotency_dinamic_api_all
  on public.audits_operation_idempotency
  for all to dinamic_api
  using (true)
  with check (true);

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
    -- Remove legacy browser ALL policy (write + read).
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);

    -- Explicit browser SELECT during/after cutover (GRANT SELECT alone is insufficient with RLS).
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_authenticated_select',
      t
    );

    -- Close browser DML; keep SELECT grant for the select policy above.
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);

    -- Backend role full DML + RLS allow.
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
