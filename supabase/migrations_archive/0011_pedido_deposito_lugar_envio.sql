-- Revisar antes de correr en el SQL Editor de Supabase.
-- Mismo criterio ya usado en pedidos_compra/ordenes_compra: se congela el
-- alias y la dirección del lugar de entrega elegido al crear el pedido a
-- depósito, no una referencia viva.
alter table pedidos_deposito add column if not exists lugar_envio_texto text;
alter table pedidos_deposito add column if not exists lugar_envio_alias text;
