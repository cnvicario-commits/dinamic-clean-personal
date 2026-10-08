-- Módulo CRM de seguimiento de ventas (reemplaza la planilla Excel de
-- cotizaciones). Módulo independiente: no toca clientes/proveedores/etc.
-- Revisar antes de correr en el SQL Editor de Supabase.

-- =========================================================
-- 1. Catálogos editables (tipo de cliente, tipo de servicio, referidor)
-- =========================================================
create table if not exists crm_tipos_cliente (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

create table if not exists crm_tipos_servicio (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

create table if not exists crm_referidores (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

alter table crm_tipos_cliente enable row level security;
alter table crm_tipos_servicio enable row level security;
alter table crm_referidores enable row level security;

create policy "crm_tipos_cliente_authenticated_all" on crm_tipos_cliente
  for all to authenticated using (true) with check (true);
create policy "crm_tipos_servicio_authenticated_all" on crm_tipos_servicio
  for all to authenticated using (true) with check (true);
create policy "crm_referidores_authenticated_all" on crm_referidores
  for all to authenticated using (true) with check (true);

-- Valores iniciales (idempotente: no duplica si se vuelve a correr).
insert into crm_tipos_cliente (nombre) values
  ('Consorcio'), ('Oficinas'), ('Final de Obra'), ('Industria'), ('Evento'),
  ('Organismo'), ('Club'), ('Salud'), ('Otro')
on conflict (nombre) do nothing;

insert into crm_tipos_servicio (nombre) values
  ('Limpieza General'), ('Limpieza Integral'), ('Final de obra'), ('Evento'),
  ('Suplencia'), ('Vidrios en altura'), ('Limpieza de cocheras'),
  ('Retiro de Residuos'), ('Limpieza de alfombras'), ('Venta o alquiler'), ('Otro')
on conflict (nombre) do nothing;

insert into crm_referidores (nombre) values
  ('Romina'), ('Jorge'), ('Pamela'), ('Omar'), ('Luis Meza'), ('Ruben'), ('Christian V')
on conflict (nombre) do nothing;


-- =========================================================
-- 2. Prospectos (empresa/persona que cotiza)
-- =========================================================
create table if not exists crm_prospectos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  tipo_cliente_id  uuid references crm_tipos_cliente(id),
  contacto_nombre  text,
  telefono         text,
  email            text,
  referido_por_id  uuid references crm_referidores(id),
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

-- Reutiliza set_updated_at(), ya definida en 0001_proveedores_articulos.sql.
create trigger trg_crm_prospectos_updated_at
before update on crm_prospectos
for each row execute function set_updated_at();

alter table crm_prospectos enable row level security;
create policy "crm_prospectos_authenticated_all" on crm_prospectos
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 3. Oportunidades (cada cotización)
-- =========================================================
create table if not exists crm_oportunidades (
  id                          uuid primary key default gen_random_uuid(),
  prospecto_id                uuid not null references crm_prospectos(id) on delete cascade,
  numero_referencia           text,
  fecha_ingreso                date not null default current_date,
  tipo_servicio_id            uuid references crm_tipos_servicio(id),
  cantidad_personal           numeric,
  monto_estimado              numeric,
  estado                      text not null default 'en_seguimiento'
                                check (estado in ('en_seguimiento', 'aceptado', 'rechazado', 'en_espera')),
  fecha_envio                 date,
  fecha_cierre                date,
  comision_monto              numeric,
  comision_liquidada          boolean not null default false,
  comentarios                 text,
  responsable_id              uuid not null references perfiles(id),
  proxima_fecha_seguimiento   date,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz
);

create trigger trg_crm_oportunidades_updated_at
before update on crm_oportunidades
for each row execute function set_updated_at();

-- fecha_cierre "se completa sola": se estampa con la fecha de hoy en cuanto
-- el estado pasa a aceptado/rechazado/en_espera (en el alta si ya nace en
-- uno de esos estados, o en cualquier update que cambie el estado), y se
-- limpia si vuelve a en_seguimiento (se reabre).
create or replace function crm_set_fecha_cierre()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if new.estado in ('aceptado', 'rechazado', 'en_espera') and new.fecha_cierre is null then
      new.fecha_cierre := current_date;
    end if;
  elsif new.estado is distinct from old.estado then
    if new.estado in ('aceptado', 'rechazado', 'en_espera') then
      new.fecha_cierre := current_date;
    else
      new.fecha_cierre := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_oportunidades_fecha_cierre
before insert or update on crm_oportunidades
for each row execute function crm_set_fecha_cierre();

alter table crm_oportunidades enable row level security;
create policy "crm_oportunidades_authenticated_all" on crm_oportunidades
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 4. Seguimientos (historial de contactos por oportunidad)
-- =========================================================
create table if not exists crm_seguimientos (
  id                          uuid primary key default gen_random_uuid(),
  oportunidad_id              uuid not null references crm_oportunidades(id) on delete cascade,
  fecha_contacto              date not null default current_date,
  tipo_contacto               text,
  nota                        text,
  proxima_fecha_seguimiento   date,
  usuario_id                  uuid not null references perfiles(id),
  created_at                  timestamptz not null default now()
);

-- proxima_fecha_seguimiento "se completa sola" en la oportunidad: cada vez
-- que se registra un seguimiento NUEVO con esa fecha completada, se refleja
-- en crm_oportunidades. Si el seguimiento nuevo no trae fecha, no se toca
-- lo que ya había (no se borra el valor existente por registrar una nota
-- sin cambiar la próxima fecha).
create or replace function crm_actualizar_proxima_fecha()
returns trigger as $$
begin
  if new.proxima_fecha_seguimiento is not null then
    update crm_oportunidades
    set proxima_fecha_seguimiento = new.proxima_fecha_seguimiento
    where id = new.oportunidad_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_seguimientos_actualizar_proxima_fecha
after insert on crm_seguimientos
for each row execute function crm_actualizar_proxima_fecha();

alter table crm_seguimientos enable row level security;
create policy "crm_seguimientos_authenticated_all" on crm_seguimientos
  for all to authenticated using (true) with check (true);
