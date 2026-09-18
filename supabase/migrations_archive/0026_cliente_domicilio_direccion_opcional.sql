-- La carga real de sitios (hoja Alias) trae 77 de 166 filas sin domicilio
-- de entrega cargado (dato real: hay sitios que todavía no tienen una
-- dirección específica). Se relaja la restricción para permitirlo.
-- No afecta el alta manual desde ClienteDomicilioForm, que puede seguir
-- pidiéndolo como obligatorio en la pantalla si así se prefiere.
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table cliente_domicilios
  alter column direccion drop not null;
