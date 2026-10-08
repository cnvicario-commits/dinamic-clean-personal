-- Revisar antes de correr en el SQL Editor de Supabase.

-- Alias del domicilio elegido como lugar de envío en Órdenes de compra,
-- congelado junto con lugar_envio_texto (mismo criterio ya usado en
-- pedidos_compra: si el domicilio del cliente cambia después, la OC ya
-- emitida no se altera).
alter table ordenes_compra
  add column if not exists lugar_envio_alias text;
