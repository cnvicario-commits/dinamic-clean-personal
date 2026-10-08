-- Phase 4C correction: purchases needs the active company catalog at runtime.
-- Read-only grant; no browser or runtime DML is introduced.
grant select on table public.empresas to dinamic_api;
alter table public.empresas enable row level security;
drop policy if exists empresas_dinamic_api_select on public.empresas;
create policy empresas_dinamic_api_select on public.empresas
  for select to dinamic_api using (true);
