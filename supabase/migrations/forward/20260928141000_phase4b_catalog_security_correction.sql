-- Phase 4B correction: authenticated keeps SELECT only for temporary 4C consumers.
do $$ declare t text; begin
  foreach t in array array['proveedores','articulos','articulos_proveedor','articulos_proveedor_pendientes'] loop
    execute format('revoke all privileges on table public.%I from authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
  end loop;
end $$;

drop policy if exists proveedores_insert_admin on public.proveedores;
drop policy if exists proveedores_update_admin on public.proveedores;
drop policy if exists articulos_insert_admin on public.articulos;
drop policy if exists articulos_update_admin on public.articulos;
drop policy if exists articulos_proveedor_insert_admin on public.articulos_proveedor;
drop policy if exists articulos_proveedor_update_admin on public.articulos_proveedor;
drop policy if exists pendientes_insert_admin on public.articulos_proveedor_pendientes;
drop policy if exists pendientes_update_admin on public.articulos_proveedor_pendientes;
