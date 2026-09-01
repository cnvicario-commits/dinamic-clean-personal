-- Módulo Auditoría y Calidad (reemplaza el checklist "FR-01-01 Check List
-- del Supervisor" en Excel). Módulo independiente, no toca clientes ni
-- ventas salvo para referenciar cliente_domicilios (los "sitios").
--
-- OJO: el documento original de diseño habla de una tabla `alias`, que
-- nunca se creó — se había decidido reutilizar `cliente_domicilios` en su
-- lugar (ver 0025_clientes_activo_supervisores.sql). Todo lo que el
-- documento llama "alias_id → alias" acá es "alias_id → cliente_domicilios".
--
-- Revisar antes de correr en el SQL Editor de Supabase.

-- =========================================================
-- 1. Checklist versionable
-- =========================================================
create table if not exists auditoria_checklist_plantillas (
  id                uuid primary key default gen_random_uuid(),
  codigo_formulario text not null,
  version           text not null,
  vigencia_desde    date not null,
  activa            boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists auditoria_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references auditoria_checklist_plantillas(id) on delete cascade,
  orden        int not null,
  texto        text not null,
  created_at   timestamptz not null default now()
);

-- Solo una plantilla activa a la vez, garantizado a nivel de base (no solo
-- por la lógica de la pantalla) — mismo patrón que
-- cliente_domicilios_un_principal en 0004_cliente_domicilios.sql.
create unique index if not exists auditoria_checklist_una_activa
  on auditoria_checklist_plantillas ((true))
  where activa;

-- Al activar una plantilla, desactiva automáticamente cualquier otra que
-- estuviera activa (regla de negocio pedida: "las demás pasan a
-- activa = false automáticamente").
create or replace function auditoria_checklist_desactivar_otras()
returns trigger as $$
begin
  if new.activa then
    update auditoria_checklist_plantillas
    set activa = false
    where id <> new.id and activa;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_auditoria_checklist_desactivar_otras
after insert or update of activa on auditoria_checklist_plantillas
for each row execute function auditoria_checklist_desactivar_otras();

alter table auditoria_checklist_plantillas enable row level security;
alter table auditoria_checklist_items enable row level security;
create policy "auditoria_checklist_plantillas_authenticated_all" on auditoria_checklist_plantillas
  for all to authenticated using (true) with check (true);
create policy "auditoria_checklist_items_authenticated_all" on auditoria_checklist_items
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 2. Planificación de auditorías
-- =========================================================
create table if not exists auditoria_planificaciones (
  id               uuid primary key default gen_random_uuid(),
  alias_id         uuid not null references cliente_domicilios(id) on delete cascade,
  fecha_propuesta  date not null,
  supervisor_id    uuid not null references perfiles(id),
  estado           text not null default 'planificada'
                     check (estado in ('planificada', 'realizada', 'vencida', 'cancelada')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

create trigger trg_auditoria_planificaciones_updated_at
before update on auditoria_planificaciones
for each row execute function set_updated_at();

alter table auditoria_planificaciones enable row level security;
create policy "auditoria_planificaciones_authenticated_all" on auditoria_planificaciones
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 3. Auditoría realizada (cabecera)
-- =========================================================
create table if not exists auditorias (
  id                         uuid primary key default gen_random_uuid(),
  planificacion_id           uuid references auditoria_planificaciones(id) on delete set null,
  alias_id                   uuid not null references cliente_domicilios(id) on delete cascade,
  plantilla_id               uuid not null references auditoria_checklist_plantillas(id),
  fecha_realizada            date not null,
  supervisor_id              uuid not null references perfiles(id),
  evaluacion_general         text,
  proxima_supervision_fecha  date,
  quejas_comentarios_cliente text,
  otros                      text,
  created_at                 timestamptz not null default now()
);

alter table auditorias enable row level security;
create policy "auditorias_authenticated_all" on auditorias
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 4. Respuestas por ítem
-- =========================================================
create table if not exists auditoria_respuestas (
  id            uuid primary key default gen_random_uuid(),
  auditoria_id  uuid not null references auditorias(id) on delete cascade,
  item_id       uuid not null references auditoria_checklist_items(id),
  resultado     text not null check (resultado in ('conforme', 'no_conforme', 'no_aplica')),
  observaciones text,
  created_at    timestamptz not null default now()
);

alter table auditoria_respuestas enable row level security;
create policy "auditoria_respuestas_authenticated_all" on auditoria_respuestas
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 5. Plan de acción
-- =========================================================
create table if not exists auditoria_plan_accion (
  id               uuid primary key default gen_random_uuid(),
  auditoria_id     uuid not null references auditorias(id) on delete cascade,
  respuesta_id     uuid references auditoria_respuestas(id) on delete set null,
  descripcion      text not null,
  responsable_id   uuid references perfiles(id),
  fecha_limite     date,
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'en_curso', 'resuelto')),
  fecha_resolucion date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

create trigger trg_auditoria_plan_accion_updated_at
before update on auditoria_plan_accion
for each row execute function set_updated_at();

alter table auditoria_plan_accion enable row level security;
create policy "auditoria_plan_accion_authenticated_all" on auditoria_plan_accion
  for all to authenticated using (true) with check (true);


-- =========================================================
-- 6. Precarga: FR-01-01 REV-01 (vigente desde 30/04/2022)
-- =========================================================
insert into auditoria_checklist_plantillas (id, codigo_formulario, version, vigencia_desde, activa)
values ('00000000-0000-0000-0000-000000000001', 'FR-01-01', 'REV-01', '2022-04-30', true)
on conflict (id) do nothing;

insert into auditoria_checklist_items (plantilla_id, orden, texto)
select '00000000-0000-0000-0000-000000000001', *
from (values
  (1,  'Presencia - Uso de uniforme'),
  (2,  'Uso de EPP'),
  (3,  'Identificación de productos químicos'),
  (4,  'Orden del pañol'),
  (5,  'Hojas de seguridad de productos'),
  (6,  'Preservación de elementos de limpieza'),
  (7,  'Cumplimiento del plan de limpieza'),
  (8,  'Identificación de seguridad en los trabajos (si corresponde)'),
  (9,  'Registros de limpieza (Libro o Check list)'),
  (10, 'Personal presente vs. dotación asignada'),
  (11, 'Puntualidad - horario de ingreso y egreso'),
  (12, 'Estado y funcionamiento de máquinas y equipos'),
  (13, 'Stock de insumos (suficiente hasta próxima provisión)'),
  (14, 'Capacitación del personal (inducción, manejo de químicos, etc.)'),
  (15, 'Evaluación general del servicio.')
) as t(orden, texto)
where not exists (
  select 1 from auditoria_checklist_items where plantilla_id = '00000000-0000-0000-0000-000000000001'
);
