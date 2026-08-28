-- "Última vez que cada usuario vio cada oportunidad", para poder marcar en
-- el Kanban y en un panel de Novedades qué oportunidades tienen seguimientos
-- que el usuario todavía no vio (ver src/utils/novedades.ts).

create table if not exists crm_vistas (
  oportunidad_id uuid not null references crm_oportunidades(id) on delete cascade,
  usuario_id     uuid not null references perfiles(id) on delete cascade,
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
