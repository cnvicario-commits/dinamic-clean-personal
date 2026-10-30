-- Company writes move to the API (dinamic_api).
-- Browser roles keep SELECT. RLS for authenticated insert/update stays admin-only
-- and no longer has a matching write grant.
-- Not applied to production by this change.

grant select, insert, update on table public.empresas to dinamic_api;

drop policy if exists empresas_dinamic_api_insert on public.empresas;
create policy empresas_dinamic_api_insert on public.empresas
  for insert to dinamic_api
  with check (true);

drop policy if exists empresas_dinamic_api_update on public.empresas;
create policy empresas_dinamic_api_update on public.empresas
  for update to dinamic_api
  using (true)
  with check (true);

revoke insert, update, delete, truncate, references, trigger on table public.empresas from anon;
revoke insert, update, delete, truncate, references, trigger on table public.empresas from authenticated;
revoke select on table public.empresas from anon;
