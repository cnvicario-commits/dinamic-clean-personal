-- Permite guardar codigo_proveedor vacío/nulo en articulos_proveedor (varios
-- artículos del mismo proveedor sin código propio conviven), reemplazando el
-- unique constraint por un índice único parcial que ignora los vacíos.
-- También agrega la columna de sugerencias por nombre a los pendientes.
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table articulos_proveedor alter column codigo_proveedor drop not null;

alter table articulos_proveedor
  drop constraint if exists articulos_proveedor_proveedor_id_codigo_proveedor_key;

create unique index if not exists articulos_proveedor_proveedor_codigo_idx
  on articulos_proveedor (proveedor_id, codigo_proveedor)
  where codigo_proveedor is not null and codigo_proveedor <> '';

alter table articulos_proveedor_pendientes
  add column if not exists sugerencias jsonb;

-- Limpieza: las pendientes sin resolver que quedaron con el código
-- provisorio del fix anterior (SIN-CODIGO-FILA-N) vuelven a quedar
-- realmente vacías.
update articulos_proveedor_pendientes
  set codigo_proveedor = null
  where resuelto = false and codigo_proveedor like 'SIN-CODIGO-FILA-%';
