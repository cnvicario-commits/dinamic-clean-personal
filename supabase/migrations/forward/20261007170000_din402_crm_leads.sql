-- DIN-402: leads live behind the API role. Business ownership is enforced in apps/api.
begin;

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null references public.crm_prospectos(id) on delete cascade,
  responsable_id uuid not null references public.perfiles(id),
  estado text not null default 'por_contactar'
    check (estado in ('por_contactar', 'en_conversacion', 'convertido', 'sin_interes')),
  proxima_fecha_contacto date,
  notas text,
  oportunidad_id uuid references public.crm_oportunidades(id) on delete set null,
  fecha_conversion date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_responsable_id_idx on public.crm_leads (responsable_id);
create index if not exists crm_leads_estado_idx on public.crm_leads (estado);
create index if not exists crm_leads_proxima_fecha_contacto_idx on public.crm_leads (proxima_fecha_contacto);
create index if not exists crm_leads_prospecto_id_idx on public.crm_leads (prospecto_id);
create index if not exists crm_leads_oportunidad_id_idx on public.crm_leads (oportunidad_id);
create index if not exists crm_oportunidades_responsable_id_idx on public.crm_oportunidades (responsable_id);

drop trigger if exists trg_crm_leads_updated_at on public.crm_leads;
create trigger trg_crm_leads_updated_at
before update on public.crm_leads
for each row execute function public.set_updated_at();

create or replace function public.crm_set_fecha_conversion_lead()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists trg_crm_leads_fecha_conversion on public.crm_leads;
create trigger trg_crm_leads_fecha_conversion
before insert or update on public.crm_leads
for each row execute function public.crm_set_fecha_conversion_lead();

create table if not exists public.crm_seguimientos_leads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  fecha_contacto date not null default current_date,
  tipo_contacto text,
  nota text,
  proxima_fecha_contacto date,
  usuario_id uuid not null references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists crm_seguimientos_leads_lead_id_idx on public.crm_seguimientos_leads (lead_id);

create or replace function public.crm_actualizar_proxima_fecha_lead()
returns trigger
language plpgsql
as $$
begin
  if new.proxima_fecha_contacto is not null then
    update public.crm_leads
    set proxima_fecha_contacto = new.proxima_fecha_contacto
    where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_seguimientos_leads_proxima_fecha on public.crm_seguimientos_leads;
create trigger trg_crm_seguimientos_leads_proxima_fecha
after insert on public.crm_seguimientos_leads
for each row execute function public.crm_actualizar_proxima_fecha_lead();

alter table public.crm_leads enable row level security;
alter table public.crm_seguimientos_leads enable row level security;

revoke all on public.crm_leads from anon, authenticated;
revoke all on public.crm_seguimientos_leads from anon, authenticated;

grant select, insert, update, delete on public.crm_leads to dinamic_api;
grant select, insert, update, delete on public.crm_seguimientos_leads to dinamic_api;

drop policy if exists crm_leads_dinamic_api_all on public.crm_leads;
create policy crm_leads_dinamic_api_all
  on public.crm_leads
  for all to dinamic_api
  using (true)
  with check (true);

drop policy if exists crm_seguimientos_leads_dinamic_api_all on public.crm_seguimientos_leads;
create policy crm_seguimientos_leads_dinamic_api_all
  on public.crm_seguimientos_leads
  for all to dinamic_api
  using (true)
  with check (true);

alter table public.crm_operation_idempotency
  drop constraint if exists crm_operation_idempotency_operation_check;

alter table public.crm_operation_idempotency
  add constraint crm_operation_idempotency_operation_check
  check (operation in ('opportunity_create', 'lead_create', 'lead_convert'));

commit;
