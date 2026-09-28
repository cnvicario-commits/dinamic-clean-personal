-- Phase 4B: browser users retain legacy SELECT for 4C only; all catalog writes use dinamic_api.
create sequence if not exists public.articulos_codigo_seq;
do $$ declare current_max bigint; current_seq bigint; begin
  select coalesce(max((substring(codigo_interno from '^ART-([0-9]+)$'))::bigint),0) into current_max from public.articulos;
  select last_value into current_seq from public.articulos_codigo_seq;
  perform setval('public.articulos_codigo_seq', greatest(current_max,current_seq), true);
end $$;
create or replace function public.set_codigo_interno_articulo() returns trigger language plpgsql as $$
begin
 if new.codigo_interno is null or btrim(new.codigo_interno)='' then new.codigo_interno := 'ART-' || lpad(nextval('public.articulos_codigo_seq')::text,4,'0'); end if;
 return new;
end $$;
drop trigger if exists trg_articulos_codigo_interno on public.articulos;
create trigger trg_articulos_codigo_interno before insert on public.articulos for each row execute function public.set_codigo_interno_articulo();
do $$ declare t text; begin
 foreach t in array array['proveedores','articulos','articulos_proveedor','articulos_proveedor_pendientes'] loop
   execute format('drop policy if exists %I on public.%I', t || '_authenticated_all',t);
   execute format('revoke insert, update, delete on public.%I from authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
drop policy if exists "pendientes_authenticated_all" on public.articulos_proveedor_pendientes;
create table if not exists public.catalog_operation_idempotency (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('article_import','price_list_apply')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  payload_hash text not null,
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  response jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(actor_id,operation,idempotency_key)
);
alter table public.catalog_operation_idempotency enable row level security;
revoke all on public.catalog_operation_idempotency from authenticated;
grant select,insert,update,delete on public.catalog_operation_idempotency to dinamic_api;
grant usage, select on sequence public.articulos_codigo_seq to dinamic_api;
grant select, insert, update, delete on public.proveedores, public.articulos, public.articulos_proveedor, public.articulos_proveedor_pendientes to dinamic_api;

drop policy if exists proveedores_dinamic_api_all on public.proveedores;
create policy proveedores_dinamic_api_all on public.proveedores for all to dinamic_api using (true) with check (true);
drop policy if exists articulos_dinamic_api_all on public.articulos;
create policy articulos_dinamic_api_all on public.articulos for all to dinamic_api using (true) with check (true);
drop policy if exists articulos_proveedor_dinamic_api_all on public.articulos_proveedor;
create policy articulos_proveedor_dinamic_api_all on public.articulos_proveedor for all to dinamic_api using (true) with check (true);
drop policy if exists articulos_proveedor_pendientes_dinamic_api_all on public.articulos_proveedor_pendientes;
create policy articulos_proveedor_pendientes_dinamic_api_all on public.articulos_proveedor_pendientes for all to dinamic_api using (true) with check (true);
drop policy if exists catalog_operation_idempotency_dinamic_api_all on public.catalog_operation_idempotency;
create policy catalog_operation_idempotency_dinamic_api_all on public.catalog_operation_idempotency for all to dinamic_api using (true) with check (true);
