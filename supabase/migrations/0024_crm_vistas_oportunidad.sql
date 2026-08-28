-- "Última vez que cada usuario vio cada oportunidad", para poder marcar en
-- el Kanban y en un panel de Novedades qué oportunidades tienen seguimientos
-- que el usuario todavía no vio (ver src/utils/novedades.ts).
--
-- IMPORTANTE — usuario_id es un uuid SIN foreign key a perfiles(id) a
-- propósito (a diferencia de crm_oportunidades.responsable_id y
-- crm_seguimientos.usuario_id, que sí la tienen). La primera versión de esta
-- tabla (migración 0023, revertida) sí tenía esa FK, y eso rompió producción:
-- Supabase/PostgREST detecta automáticamente como relación "muchos a muchos"
-- a cualquier tabla que tenga foreign keys hacia dos tablas a la vez — al
-- tener una FK a crm_oportunidades y otra a perfiles, pasó a haber DOS
-- caminos posibles entre crm_oportunidades y perfiles (el de siempre, por
-- responsable_id, y este nuevo), y toda consulta que trae "oportunidad +
-- nombre del responsable" (el tablero, el listado, la ficha, la agenda, el
-- resumen — TODAS las pantallas de Ventas) empezó a fallar con "Could not
-- embed because more than one relationship was found". Sin esa segunda FK,
-- crm_vistas solo se conecta con crm_oportunidades y no puede generar esa
-- ambigüedad. La integridad de usuario_id se valida en la app (siempre es
-- auth.uid()), no hace falta el constraint en la base para esto.
create table if not exists crm_vistas (
  oportunidad_id uuid not null references crm_oportunidades(id) on delete cascade,
  usuario_id     uuid not null,
  last_viewed_at timestamptz not null default now(),
  primary key (oportunidad_id, usuario_id)
);

alter table crm_vistas enable row level security;
create policy "crm_vistas_authenticated_all" on crm_vistas
  for all to authenticated using (true) with check (true);

-- Bootstrap: marca como "ya visto, recién ahora" todo lo existente para
-- admin/gerente (los únicos roles con acceso a /ventas, ver permisos.ts) —
-- así al desplegar esto no aparece de golpe todo el historial como novedad,
-- solo lo que se cargue de acá en adelante.
insert into crm_vistas (oportunidad_id, usuario_id, last_viewed_at)
select o.id, p.id, now()
from crm_oportunidades o
cross join perfiles p
where p.rol in ('admin', 'gerente')
on conflict (oportunidad_id, usuario_id) do nothing;
