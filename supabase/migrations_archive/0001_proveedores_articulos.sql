-- Módulo Proveedores + Artículos + Listas de precios
-- Revisar antes de correr en el SQL Editor de Supabase.

-- =========================================================
-- 1. PROVEEDORES
-- =========================================================
create table if not exists proveedores (
  id            uuid primary key default gen_random_uuid(),
  razon_social  text not null,
  cuit          text not null unique,
  domicilio     text,
  telefono      text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

-- Mantiene updated_at al día en cada edición (este módulo sí soporta edición).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_proveedores_updated_at
before update on proveedores
for each row execute function set_updated_at();

alter table proveedores enable row level security;
create policy "proveedores_authenticated_all" on proveedores
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 2. ARTICULOS (codigo_interno autogenerado, secuencia atómica)
-- =========================================================
create sequence if not exists articulos_codigo_seq;

create or replace function set_codigo_interno_articulo()
returns trigger as $$
begin
  if new.codigo_interno is null or new.codigo_interno = '' then
    new.codigo_interno := 'ART-' || lpad(nextval('articulos_codigo_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create table if not exists articulos (
  id             uuid primary key default gen_random_uuid(),
  codigo_interno text not null unique,   -- lo completa el trigger BEFORE INSERT
  nombre         text not null,
  categoria      text,
  unidad         text,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create trigger trg_articulos_set_codigo
before insert on articulos
for each row execute function set_codigo_interno_articulo();

alter table articulos enable row level security;
create policy "articulos_authenticated_all" on articulos
  for all to authenticated using (true) with check (true);

-- Nota: el insert client-side NO debe enviar codigo_interno (o debe
-- enviarlo null/''); el trigger BEFORE INSERT lo completa antes de que
-- Postgres valide el NOT NULL/UNIQUE.


-- =========================================================
-- 3. ARTICULOS_PROVEEDOR (vínculo N:M con precio)
-- =========================================================
create table if not exists articulos_proveedor (
  id                  uuid primary key default gen_random_uuid(),
  articulo_id         uuid not null references articulos(id) on delete cascade,
  proveedor_id        uuid not null references proveedores(id) on delete cascade,
  codigo_proveedor    text not null,
  nombre_proveedor    text,
  precio              numeric not null,
  fecha_actualizacion timestamptz not null default now(),
  activo              boolean not null default true,
  unique (proveedor_id, codigo_proveedor)
);

alter table articulos_proveedor enable row level security;
create policy "articulos_proveedor_authenticated_all" on articulos_proveedor
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 4. ARTICULOS_PROVEEDOR_PENDIENTES (líneas de Excel sin matchear)
-- =========================================================
create table if not exists articulos_proveedor_pendientes (
  id               uuid primary key default gen_random_uuid(),
  proveedor_id     uuid not null references proveedores(id) on delete cascade,
  codigo_proveedor text,
  nombre_proveedor text,
  precio           numeric,
  archivo_origen   text,
  resuelto         boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table articulos_proveedor_pendientes enable row level security;
create policy "pendientes_authenticated_all" on articulos_proveedor_pendientes
  for all to authenticated using (true) with check (true);
