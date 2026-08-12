-- Revisar antes de correr en el SQL Editor de Supabase.
-- Campos nuevos para el rediseño del PDF de Orden de Compra.
-- Nota: ordenes_compra.lugar_envio_alias ya existe (migración 0009), no se
-- vuelve a crear acá.

-- proveedores
alter table proveedores add column if not exists provincia text;
alter table proveedores add column if not exists condicion_pago_default text;

-- cliente_domicilios
alter table cliente_domicilios add column if not exists horario_atencion text;

-- ordenes_compra
alter table ordenes_compra add column if not exists condicion_pago text;
alter table ordenes_compra add column if not exists horario_atencion_texto text;
