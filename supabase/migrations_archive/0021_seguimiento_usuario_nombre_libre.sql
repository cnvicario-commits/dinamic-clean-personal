-- Mismo criterio que 0020_responsable_nombre_libre.sql, aplicado a crm_seguimientos:
-- permite registrar quién hizo el contacto aunque no tenga cuenta de usuario en la app
-- (necesario para los seguimientos de la importación histórica).

alter table crm_seguimientos
  alter column usuario_id drop not null;

alter table crm_seguimientos
  add column usuario_nombre_libre text;

alter table crm_seguimientos
  add constraint crm_seguimientos_usuario_check
  check (usuario_id is not null or usuario_nombre_libre is not null);
