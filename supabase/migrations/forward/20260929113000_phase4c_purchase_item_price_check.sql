-- Phase 4C invariant: an order line cannot carry a zero/negative price.
alter table public.ordenes_compra_items
  add constraint ordenes_compra_items_precio_unitario_check
  check (precio_unitario > 0) not valid;
alter table public.ordenes_compra_items
  validate constraint ordenes_compra_items_precio_unitario_check;
