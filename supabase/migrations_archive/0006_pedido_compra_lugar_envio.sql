-- Lugar de envío sugerido en el pedido de compra (a diferencia de la orden de
-- compra, acá se guarda como REFERENCIA viva, no como texto congelado: el
-- pedido de compra no es un documento emitido a un tercero, es solo la
-- preferencia que después se propone por defecto al generar la OC en el
-- Panel de compras. Si el domicilio del cliente se corrige mientras el
-- pedido sigue en borrador/enviada, tiene sentido que se vea el dato
-- actualizado. Recién al generar la OC ese valor se copia como texto fijo
-- en ordenes_compra.lugar_envio_texto (migración 0005).
--
-- Revisar antes de correr en el SQL Editor de Supabase. Columnas nuevas,
-- nullable/con default: no afectan los pedidos ya existentes.

alter table pedidos_compra
  add column if not exists lugar_envio_domicilio_id uuid references cliente_domicilios(id) on delete set null;

alter table pedidos_compra
  add column if not exists lugar_envio_empresa boolean not null default false;
