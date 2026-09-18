-- El horario de la planificación pasa a ser un rango (desde/hasta) en vez de
-- una hora puntual, para poder anotar franjas como "09:00 a 12:00".
-- La columna `horario` de 0032 no llegó a usarse (todas las planificaciones
-- existentes la tienen en null), así que se reemplaza directamente en vez de
-- mantenerla en paralelo.
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table auditoria_planificaciones
  drop column if exists horario,
  add column if not exists horario_desde time,
  add column if not exists horario_hasta time;
