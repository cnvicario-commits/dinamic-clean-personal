-- Módulo Auditoría y Calidad: se agregan a la planificación el horario
-- propuesto y un campo abierto de observaciones (pedido para anotar
-- cualquier dato adicional al planificar, ej. "coordinar con el encargado
-- de turno noche"). Ambas opcionales: las planificaciones ya cargadas no
-- tienen estos datos y no hace falta completarlos para planificar.
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table auditoria_planificaciones
  add column if not exists horario time,
  add column if not exists observaciones text;
