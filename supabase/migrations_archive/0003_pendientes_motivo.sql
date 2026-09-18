-- Agrega un motivo opcional a las pendientes de vinculación de precios, para
-- poder distinguir "no matcheó ningún código de proveedor" de "el
-- codigo_interno indicado en el Excel no existe en el catálogo" (carga de
-- listas de precios con vinculación directa por código interno).
-- No se modifica ninguna columna existente ni el resto de la tabla.

alter table articulos_proveedor_pendientes
  add column if not exists motivo text;
