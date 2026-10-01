-- Leads: seguimiento comercial de potenciales clientes ANTES de que haya
-- algo concreto para cotizar (eso sigue siendo una Oportunidad, en
-- crm_oportunidades — no cambia). Un mismo prospecto (crm_prospectos) puede
-- tener un lead de un vendedor y, más adelante, una oportunidad de otro —
-- son conceptos independientes que solo comparten el directorio de
-- prospectos.
-- Revisar antes de correr en el SQL Editor de Supabase.

-- =========================================================
-- 1. Leads
-- =========================================================
-- Nota sobre las foreign keys: esta tabla tiene FKs a crm_prospectos,
-- perfiles Y crm_oportunidades (tres), pero con su propio "id" como primary
-- key — no una PK compuesta por las FKs. El bug de PostgREST documentado en
-- 0024_crm_vistas_oportunidad.sql ("relación muchos a muchos" ambigua) es
-- específico de tablas puente con PK compuesta exactamente por las dos FKs
-- (eso rompió crm_vistas); una tabla con su propio id y columnas propias no
-- se detecta como ese tipo de puente — mismo caso que crm_seguimientos, que
-- ya convive sin problema con la FK de crm_oportunidades hacia perfiles.
create table if not exists crm_leads (
  id                      uuid primary key default gen_random_uuid(),
  prospecto_id            uuid not null references crm_prospectos(id) on delete cascade,
  responsable_id          uuid not null references perfiles(id),
  estado                  text not null default 'por_contactar'
                            check (estado in ('por_contactar', 'en_conversacion', 'convertido', 'sin_interes')),
  proxima_fecha_contacto  date,
  notas                   text,
  -- Se completa al convertir el lead en Oportunidad (ver OportunidadForm.tsx):
  -- queda el antecedente enlazado, sin mezclar el historial de seguimientos
  -- de uno y otro.
  oportunidad_id          uuid references crm_oportunidades(id),
  fecha_conversion        date,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz
);

create trigger trg_crm_leads_updated_at
before update on crm_leads
for each row execute function set_updated_at();

-- fecha_conversion "se completa sola", mismo criterio que fecha_cierre en
-- crm_oportunidades (migración 0018): se estampa al entrar a 'convertido' y
-- se limpia si se reabre.
create or replace function crm_set_fecha_conversion_lead()
returns trigger as $$
begin
  if new.estado = 'convertido' then
    if new.fecha_conversion is null then
      new.fecha_conversion := current_date;
    end if;
  else
    new.fecha_conversion := null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_leads_fecha_conversion
before insert or update on crm_leads
for each row execute function crm_set_fecha_conversion_lead();

alter table crm_leads enable row level security;

-- Mismo criterio que crm_oportunidades (migración 0035): cada vendedor ve y
-- edita solo sus propios leads, admin ve todos.
create policy "crm_leads_propio_o_admin" on crm_leads
  for all to authenticated
  using (
    responsable_id = auth.uid()
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  )
  with check (
    responsable_id = auth.uid()
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  );


-- =========================================================
-- 2. Seguimientos de leads (historial de contactos, antes de la oportunidad)
-- =========================================================
create table if not exists crm_seguimientos_leads (
  id                      uuid primary key default gen_random_uuid(),
  lead_id                 uuid not null references crm_leads(id) on delete cascade,
  fecha_contacto          date not null default current_date,
  tipo_contacto           text,
  nota                    text,
  proxima_fecha_contacto  date,
  usuario_id              uuid not null references perfiles(id),
  created_at              timestamptz not null default now()
);

-- proxima_fecha_contacto "se completa sola" en el lead, mismo criterio que
-- crm_seguimientos/proxima_fecha_seguimiento (migración 0018): si el
-- seguimiento nuevo no trae fecha, no se toca lo que ya había.
create or replace function crm_actualizar_proxima_fecha_lead()
returns trigger as $$
begin
  if new.proxima_fecha_contacto is not null then
    update crm_leads
    set proxima_fecha_contacto = new.proxima_fecha_contacto
    where id = new.lead_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_seguimientos_leads_actualizar_proxima_fecha
after insert on crm_seguimientos_leads
for each row execute function crm_actualizar_proxima_fecha_lead();

alter table crm_seguimientos_leads enable row level security;

-- Igual que crm_seguimientos: no importa quién cargó el seguimiento, sino de
-- quién es el lead al que pertenece.
create policy "crm_seguimientos_leads_propio_o_admin" on crm_seguimientos_leads
  for all to authenticated
  using (
    exists (
      select 1 from crm_leads
      where crm_leads.id = crm_seguimientos_leads.lead_id
        and crm_leads.responsable_id = auth.uid()
    )
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  )
  with check (
    exists (
      select 1 from crm_leads
      where crm_leads.id = crm_seguimientos_leads.lead_id
        and crm_leads.responsable_id = auth.uid()
    )
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  );
