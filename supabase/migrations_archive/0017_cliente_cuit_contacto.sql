-- Agrega CUIT y persona de contacto al alta de Cliente. Ambos opcionales
-- (mismo criterio que domicilio/código de costos, ya opcionales en ese
-- mismo formulario). Sin backfill: clientes ya existentes quedan en null
-- hasta que se completen a mano.
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table clientes add column if not exists cuit text;
alter table clientes add column if not exists persona_contacto text;
