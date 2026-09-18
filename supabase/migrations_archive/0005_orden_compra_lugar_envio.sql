-- Lugar de envío de la orden de compra. Se guarda el TEXTO de la dirección
-- elegida en el momento de crear la OC (domicilio del cliente o de la
-- empresa) — igual criterio que el precio unitario de las líneas: si el
-- domicilio del cliente cambia después, las OC ya emitidas no se alteran.
--
-- Revisar antes de correr en el SQL Editor de Supabase. Columna nueva y
-- nullable: no afecta las OC ya existentes.

alter table ordenes_compra add column if not exists lugar_envio_texto text;
