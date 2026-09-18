-- Revisar antes de correr en el SQL Editor de Supabase.

-- 1. Lugar de entrega en Pedido de compra: mismo criterio que ordenes_compra
--    (migración 0005) — se congela el TEXTO de la dirección elegida al
--    guardar, no solo la referencia, para que un pedido ya emitido no
--    cambie si el domicilio del cliente se edita después.
alter table pedidos_compra
  add column if not exists lugar_envio_texto text;

-- 2. Descartar línea en Panel de compras: permite marcar una línea de un
--    pedido de compra como descartada (no genera OC ni pedido a depósito
--    para ella, y cuenta como "resuelta" en el cálculo de pendiente/procesado
--    del Panel de compras).
alter table pedidos_compra_items
  add column if not exists descartada boolean not null default false;
alter table pedidos_compra_items
  add column if not exists motivo_descarte text;

-- La tabla ya tenía una política de UPDATE restringida a perfiles.rol='admin'
-- (pedidos_compra_items_update_admin). Se suma esta política adicional para
-- que cualquier usuario autenticado pueda descartar/revertir una línea desde
-- el Panel de compras, sin depender de tener rol admin. Las políticas RLS se
-- combinan con OR, así que esto no quita la de admin, solo amplía el acceso.
create policy "pedidos_compra_items_update_authenticated" on pedidos_compra_items
  for update to authenticated using (true) with check (true);
