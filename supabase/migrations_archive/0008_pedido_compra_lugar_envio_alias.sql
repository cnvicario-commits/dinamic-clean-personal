-- Revisar antes de correr en el SQL Editor de Supabase.

-- Alias del domicilio elegido como lugar de entrega, congelado junto con
-- lugar_envio_texto (mismo criterio: si el domicilio del cliente cambia
-- después, el pedido ya emitido no se altera).
alter table pedidos_compra
  add column if not exists lugar_envio_alias text;
