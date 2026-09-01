-- La tabla perfiles (no versionada en este repo, creada fuera de las
-- migraciones) tiene un check constraint que limita perfiles.rol a los 4
-- roles originales. Se amplía para incluir el rol nuevo 'auditoria'
-- (acotado solo al módulo de Auditoría y Calidad — ver src/utils/permisos.ts).
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table perfiles drop constraint perfiles_rol_check;

alter table perfiles add constraint perfiles_rol_check
  check (rol = any (array['admin', 'gerente', 'compras', 'supervisor', 'auditoria']));
