-- Rollback Phase 3A grants. Restores the historical admin-only browser DML path.
BEGIN;

DROP POLICY IF EXISTS empleados_dinamic_api_select ON public.empleados;
DROP POLICY IF EXISTS empleados_dinamic_api_insert ON public.empleados;
DROP POLICY IF EXISTS empleados_dinamic_api_update ON public.empleados;
DROP POLICY IF EXISTS asignaciones_dinamic_api_select ON public.asignaciones;
DROP POLICY IF EXISTS asignaciones_dinamic_api_insert ON public.asignaciones;
DROP POLICY IF EXISTS asignaciones_dinamic_api_update ON public.asignaciones;

REVOKE ALL ON TABLE public.empleados FROM dinamic_api;
REVOKE ALL ON TABLE public.asignaciones FROM dinamic_api;
GRANT SELECT ON TABLE public.empleados, public.asignaciones TO dinamic_api;

GRANT INSERT, UPDATE ON public.empleados, public.asignaciones TO authenticated, anon;

COMMIT;
