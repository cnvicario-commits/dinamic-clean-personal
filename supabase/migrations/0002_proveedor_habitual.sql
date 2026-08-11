-- Proveedor habitual de un artículo (opcional).
-- Revisar antes de correr en el SQL Editor de Supabase.

-- 1. Columna nueva. on delete set null (no cascade): si se borra un
--    proveedor, el artículo no debe desaparecer, solo perder la referencia.
alter table articulos
  add column proveedor_habitual_id uuid references proveedores(id) on delete set null;

-- 2. Verificar ANTES de correr el UPDATE que el nombre matchea un único
--    proveedor. Si esto devuelve 0 o más de 1 fila, avisar antes de seguir.
--    Nota: el proveedor real se llama "Casa Thames", no "Thames" a secas
--    (confirmado corriendo `select razon_social from proveedores`).
select id, razon_social from proveedores where razon_social = 'Casa Thames';

-- 3. Carga inicial: todos los artículos existentes quedan con Casa Thames
--    como proveedor habitual. Con match exacto por razon_social, si el
--    SELECT de arriba no encuentra nada esto no rompe nada (deja todo en null).
update articulos
set proveedor_habitual_id = (select id from proveedores where razon_social = 'Casa Thames')
where proveedor_habitual_id is null;
