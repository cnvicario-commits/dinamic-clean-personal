-- Phase 4C: purchase writes are authoritative in the API only.  Browser
-- clients retain no DML privilege; dinamic_api is intentionally the runtime
-- role used by the repository, never the migration/deployment connection.
do $$ declare t text; begin
  foreach t in array array[
    'pedidos_compra','pedidos_compra_items','ordenes_compra','ordenes_compra_items',
    'pedidos_deposito','pedidos_deposito_items'
  ] loop
    execute format('revoke all privileges on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to dinamic_api', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_dinamic_api_all', t);
    execute format('create policy %I on public.%I for all to dinamic_api using (true) with check (true)', t || '_dinamic_api_all', t);
  end loop;
end $$;

drop policy if exists ordenes_compra_insert_admin on public.ordenes_compra;
drop policy if exists ordenes_compra_update_admin on public.ordenes_compra;
drop policy if exists ordenes_compra_items_insert_admin on public.ordenes_compra_items;
drop policy if exists ordenes_compra_items_update_admin on public.ordenes_compra_items;
drop policy if exists pedidos_compra_insert_logged on public.pedidos_compra;
drop policy if exists pedidos_compra_update_admin_or_creador on public.pedidos_compra;
drop policy if exists pedidos_compra_items_insert_logged on public.pedidos_compra_items;
drop policy if exists pedidos_compra_items_update_admin on public.pedidos_compra_items;
drop policy if exists pedidos_compra_items_update_authenticated on public.pedidos_compra_items;
drop policy if exists pedidos_deposito_insert_admin on public.pedidos_deposito;
drop policy if exists pedidos_deposito_update_admin on public.pedidos_deposito;
drop policy if exists pedidos_deposito_items_insert_admin on public.pedidos_deposito_items;
drop policy if exists pedidos_deposito_items_update_admin on public.pedidos_deposito_items;

grant usage, select on sequence public.pedidos_compra_numero_seq,
  public.ordenes_compra_numero_seq, public.pedidos_deposito_numero_seq to dinamic_api;

-- Allocation reads and row locks always start from an item of a purchase
-- request.  These indexes keep the critical transaction bounded.
create index if not exists ordenes_compra_items_pedido_compra_item_idx
  on public.ordenes_compra_items(pedido_compra_item_id) where pedido_compra_item_id is not null;
create index if not exists pedidos_deposito_items_pedido_compra_item_idx
  on public.pedidos_deposito_items(pedido_compra_item_id) where pedido_compra_item_id is not null;

-- Persistent replay protection for operations which can commit before the
-- caller receives a response.  A single key is serialized by its primary key.
create table if not exists public.purchase_operation_idempotency (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('purchase_request_import','purchase_order_generate')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  payload_hash text not null,
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key)
);
alter table public.purchase_operation_idempotency enable row level security;
revoke all on public.purchase_operation_idempotency from authenticated;
grant select, insert, update, delete on public.purchase_operation_idempotency to dinamic_api;
drop policy if exists purchase_operation_idempotency_dinamic_api_all on public.purchase_operation_idempotency;
create policy purchase_operation_idempotency_dinamic_api_all on public.purchase_operation_idempotency
  for all to dinamic_api using (true) with check (true);
