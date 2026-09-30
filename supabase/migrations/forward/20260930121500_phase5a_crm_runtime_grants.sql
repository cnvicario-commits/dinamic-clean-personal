-- Phase 5A corrective forward migration.
--
-- The API pool intentionally runs as the least-privilege `dinamic_api` role.
-- This migration repairs installations where the CRM API code was deployed
-- before its table grants and RLS policies. It is safe after the original
-- Phase 5A migration because grants and policies are idempotent.
--
-- Preconditions: run the repository compatibility check against the approved
-- Development/Test Supabase project before applying this migration.
begin;

grant usage on schema public to dinamic_api;

grant select, insert, update, delete
  on table public.crm_operation_idempotency
  to dinamic_api;

drop policy if exists crm_operation_idempotency_dinamic_api_all
  on public.crm_operation_idempotency;
create policy crm_operation_idempotency_dinamic_api_all
  on public.crm_operation_idempotency
  for all to dinamic_api using (true) with check (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_prospectos',
    'crm_oportunidades',
    'crm_seguimientos',
    'crm_referidores',
    'crm_tipos_cliente',
    'crm_tipos_servicio',
    'crm_vistas'
  ] loop
    execute format(
      'grant select, insert, update, delete on table public.%I to dinamic_api',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_dinamic_api_all',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to dinamic_api using (true) with check (true)',
      table_name || '_dinamic_api_all',
      table_name
    );
  end loop;
end $$;

commit;
