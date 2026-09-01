-- Corrección de contenido (no de esquema): el ítem 15 del checklist activo
-- decía "Evaluación general del servicio." (texto del documento de diseño
-- original), pero en el uso real en campo (ver Excel "Audiroria servicios
-- LIKA") ese ítem es "Estado edilicio / mantenimiento detectado". Se
-- corrige el texto del ítem existente (mismo id): las auditorías ya
-- cargadas quedan igual vinculadas a ese ítem, solo cambia cómo se ve.
-- Revisar antes de correr en el SQL Editor de Supabase.

update auditoria_checklist_items
set texto = 'Estado edilicio / mantenimiento detectado'
where texto = 'Evaluación general del servicio.'
  and plantilla_id = (select id from auditoria_checklist_plantillas where activa);
