-- Permite que una oportunidad tenga un responsable que no tiene cuenta de usuario en
-- la app (ej. gente que gestionaba ventas antes de este sistema, como en la planilla
-- histórica importada). responsable_id sigue siendo la referencia real a perfiles
-- cuando existe cuenta; responsable_nombre_libre es el nombre en texto plano cuando no.
-- Se exige que al menos uno de los dos esté completo.

alter table crm_oportunidades
  alter column responsable_id drop not null;

alter table crm_oportunidades
  add column responsable_nombre_libre text;

alter table crm_oportunidades
  add constraint crm_oportunidades_responsable_check
  check (responsable_id is not null or responsable_nombre_libre is not null);
