do $$ begin
  if exists (select 1 from public.resultados_mensuales_detalle d left join public.resultados_mensuales h on h.anio=d.anio and h.mes=d.mes where h.id is null) then raise exception 'orphan resultados_mensuales_detalle rows prevent FK'; end if;
end $$;
alter table public.resultados_mensuales_detalle add column if not exists resultados_mensuales_id uuid;
update public.resultados_mensuales_detalle d set resultados_mensuales_id=h.id from public.resultados_mensuales h where h.anio=d.anio and h.mes=d.mes and d.resultados_mensuales_id is null;
alter table public.resultados_mensuales_detalle alter column resultados_mensuales_id set not null;
alter table public.resultados_mensuales_detalle drop constraint if exists resultados_mensuales_detalle_resultado_fk;
alter table public.resultados_mensuales_detalle add constraint resultados_mensuales_detalle_resultado_fk foreign key (resultados_mensuales_id) references public.resultados_mensuales(id);
create index if not exists resultados_mensuales_detalle_header_idx on public.resultados_mensuales_detalle(resultados_mensuales_id);
create table if not exists public.resultados_import_idempotency(id uuid primary key default gen_random_uuid(),actor_id uuid not null,idempotency_key text not null,payload_hash text not null,status text not null,response jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(actor_id,idempotency_key));
alter table public.resultados_mensuales enable row level security;
alter table public.resultados_mensuales_detalle enable row level security;
alter table public.resultados_import_idempotency enable row level security;
revoke all on public.resultados_mensuales,public.resultados_mensuales_detalle,public.resultados_import_idempotency from anon,authenticated;
grant select on public.resultados_mensuales,public.resultados_mensuales_detalle to dinamic_api;
grant insert,update,delete on public.resultados_mensuales,public.resultados_mensuales_detalle,public.resultados_import_idempotency to dinamic_api;
grant select on public.resultados_import_idempotency to dinamic_api;
