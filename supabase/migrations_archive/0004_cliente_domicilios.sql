-- Domicilios de entrega por cliente (un cliente puede tener varios). No
-- reemplaza ni modifica la columna clientes.domicilio existente, que queda
-- como está: esta es una sección aparte.
--
-- Revisar antes de correr en el SQL Editor de Supabase.

create table if not exists cliente_domicilios (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id) on delete cascade,
  alias        text not null,
  direccion    text not null,
  es_principal boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Un solo domicilio "principal" por cliente a la vez, garantizado a nivel de
-- base de datos (no solo por la lógica de la pantalla).
create unique index if not exists cliente_domicilios_un_principal
  on cliente_domicilios (cliente_id)
  where es_principal;

alter table cliente_domicilios enable row level security;
create policy "cliente_domicilios_authenticated_all" on cliente_domicilios
  for all to authenticated using (true) with check (true);

-- Migración de datos: la tabla clientes no tiene columna "activo" (no existe
-- el concepto de cliente dado de baja hoy), así que se migra cualquier
-- cliente que ya tenga un domicilio cargado, sin filtrar por estado.
insert into cliente_domicilios (cliente_id, alias, direccion, es_principal, activo)
select id, 'Principal', domicilio, true, true
from clientes
where domicilio is not null and btrim(domicilio) <> '';
