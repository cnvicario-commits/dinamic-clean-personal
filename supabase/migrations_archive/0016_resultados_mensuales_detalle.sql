-- Detalle de conceptos por rubro (por ahora solo 'costos_directos'), para
-- poder desplegar "Total Costos Directos" en el panel y ver de qué se
-- compone mes a mes. Revisar antes de correr en el SQL Editor de Supabase.

create table if not exists resultados_mensuales_detalle (
  id       uuid primary key default gen_random_uuid(),
  anio     integer not null,
  mes      integer not null check (mes between 1 and 12),
  rubro    text not null,
  concepto text not null,
  monto    numeric,
  unique (anio, mes, rubro, concepto)
);

alter table resultados_mensuales_detalle enable row level security;

create policy "resultados_mensuales_detalle_select_authenticated" on resultados_mensuales_detalle
  for select to authenticated using (true);

create policy "resultados_mensuales_detalle_insert_admin" on resultados_mensuales_detalle
  for insert to authenticated
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'));

create policy "resultados_mensuales_detalle_update_admin" on resultados_mensuales_detalle
  for update to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'))
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'));

-- DELETE admin: la importación borra y reinserta el detalle de cada mes en
-- cada carga (reemplazo completo), para que un concepto que desaparezca de
-- una carga posterior no quede huérfano.
create policy "resultados_mensuales_detalle_delete_admin" on resultados_mensuales_detalle
  for delete to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'));
