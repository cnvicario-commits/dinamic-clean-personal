-- Phase 4C correction: read-only client/address catalogs consumed by purchases.
grant select on table public.clientes, public.cliente_domicilios to dinamic_api;
alter table public.clientes enable row level security;
alter table public.cliente_domicilios enable row level security;
drop policy if exists clientes_dinamic_api_select on public.clientes;
create policy clientes_dinamic_api_select on public.clientes for select to dinamic_api using (true);
drop policy if exists cliente_domicilios_dinamic_api_select on public.cliente_domicilios;
create policy cliente_domicilios_dinamic_api_select on public.cliente_domicilios for select to dinamic_api using (true);
