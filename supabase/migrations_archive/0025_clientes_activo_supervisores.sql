-- Carga masiva de Clientes y Alias (sitios de entrega).
-- No toca el módulo de Ventas (crm_*): son tablas totalmente separadas.
-- Revisar antes de correr en el SQL Editor de Supabase.

-- =========================================================
-- 1. Clientes: columna "activo" (para dar de baja sin borrar)
-- =========================================================
alter table clientes
  add column if not exists activo boolean not null default true;


-- =========================================================
-- 2. Catálogo editable de supervisores (mismo patrón que los
--    catálogos del CRM de ventas: crm_tipos_cliente, etc.)
-- =========================================================
create table if not exists supervisores (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

alter table supervisores enable row level security;
create policy "supervisores_authenticated_all" on supervisores
  for all to authenticated using (true) with check (true);

-- Valores iniciales (idempotente: no duplica si se vuelve a correr).
insert into supervisores (nombre) values
  ('Christian'), ('Ruben'), ('Jorge'), ('Solange')
on conflict (nombre) do nothing;


-- =========================================================
-- 3. cliente_domicilios: agregar supervisor del sitio
--    (reutilizamos esta tabla existente en vez de crear una tabla
--    "alias" nueva y separada: ya es el concepto de "sitio/dirección
--    de entrega por cliente" que se necesita para la carga del Excel,
--    y ya la usa el módulo de Compras).
-- =========================================================
alter table cliente_domicilios
  add column if not exists supervisor_id uuid references supervisores(id) on delete set null;
