-- Módulo "Resultados económicos": tabla de totales mensuales por rubro
-- (Dinamic + Moral consolidado), cargada desde el Excel ya usado hoy para
-- calcularlos. No guarda el detalle interno de cada rubro.
-- Revisar antes de correr en el SQL Editor de Supabase.
--
-- OJO: las políticas de insert/update asumen que perfiles.id = auth.uid()
-- (el id del perfil es el mismo que el del usuario logueado). Si en tu
-- tabla perfiles el vínculo con el usuario usa otra columna (ej. user_id),
-- ajustá el "where perfiles.id = auth.uid()" antes de correr esto.

create table if not exists resultados_mensuales (
  id                          uuid primary key default gen_random_uuid(),
  anio                        integer not null,
  mes                         integer not null check (mes between 1 and 12),
  ventas_dinamic              numeric,
  ventas_moral                numeric,
  total_ventas                numeric,
  total_costos_directos       numeric,
  resultado_bruto             numeric,
  total_rrhh                  numeric,
  total_estructura_servicios  numeric,
  total_honorarios_abonos     numeric,
  total_gastos_financieros    numeric,
  total_gastos_comerciales    numeric,
  total_otros_gastos          numeric,
  total_impuestos             numeric,
  resultado_periodo           numeric,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (anio, mes)
);

-- Reutiliza set_updated_at(), ya definida en 0001_proveedores_articulos.sql.
create trigger trg_resultados_mensuales_updated_at
before update on resultados_mensuales
for each row execute function set_updated_at();

alter table resultados_mensuales enable row level security;

create policy "resultados_mensuales_select_authenticated" on resultados_mensuales
  for select to authenticated using (true);

create policy "resultados_mensuales_insert_admin" on resultados_mensuales
  for insert to authenticated
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'));

create policy "resultados_mensuales_update_admin" on resultados_mensuales
  for update to authenticated
  using (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'))
  with check (exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin'));
