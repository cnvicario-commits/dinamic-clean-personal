-- main-sync: extend perfiles.rol check constraint for sales-only role 'ventas'.
-- UI route scope: src/utils/permisos.ts (/ventas/*). API grants: crm:* via RBAC.

BEGIN;

ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check
  CHECK (rol = ANY (ARRAY[
    'admin'::text,
    'gerente'::text,
    'compras'::text,
    'supervisor'::text,
    'auditoria'::text,
    'ventas'::text
  ]));

COMMIT;
