-- Adjuntar PDFs de presupuestos enviados a un cliente, para que queden en
-- su ficha. Bucket privado nuevo, creado acá por SQL (a diferencia del
-- bucket "justificaciones" de Ausencias, que se creó a mano desde el
-- dashboard y no está versionado en el repo). Se guarda el path del
-- archivo, no un link con vencimiento: la signed URL se genera recién al
-- momento de ver/descargar, desde la pantalla.
-- Revisar antes de correr en el SQL Editor de Supabase.

insert into storage.buckets (id, name, public)
values ('presupuestos-clientes', 'presupuestos-clientes', false)
on conflict (id) do nothing;

create policy "presupuestos_clientes_storage_authenticated_all"
on storage.objects
for all
to authenticated
using (bucket_id = 'presupuestos-clientes')
with check (bucket_id = 'presupuestos-clientes');

create table if not exists cliente_presupuestos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references clientes(id) on delete cascade,
  storage_path   text not null,
  nombre_archivo text not null,
  subido_por     uuid references perfiles(id),
  created_at     timestamptz not null default now()
);

alter table cliente_presupuestos enable row level security;
create policy "cliente_presupuestos_authenticated_all" on cliente_presupuestos
  for all to authenticated using (true) with check (true);
