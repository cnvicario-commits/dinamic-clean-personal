-- Phase 3A — Core HR backend grants and PostgREST DML closure.
BEGIN;

REVOKE ALL ON TABLE public.empleados FROM dinamic_api;
GRANT SELECT ON TABLE public.empleados TO dinamic_api;
GRANT INSERT (nombre_apellido, cuil, legajo, fecha_ingreso, horas_contrato, empresa)
  ON public.empleados TO dinamic_api;
GRANT UPDATE (activo) ON public.empleados TO dinamic_api;

REVOKE ALL ON TABLE public.asignaciones FROM dinamic_api;
GRANT SELECT ON TABLE public.asignaciones TO dinamic_api;
GRANT INSERT (empleado_id, cliente_id, fecha_desde) ON public.asignaciones TO dinamic_api;
GRANT UPDATE (fecha_hasta) ON public.asignaciones TO dinamic_api;

-- Catalog dependency only; clients remain owned by its existing domain.
GRANT SELECT (id, nombre) ON public.clientes TO dinamic_api;

DROP POLICY IF EXISTS empleados_dinamic_api_select ON public.empleados;
CREATE POLICY empleados_dinamic_api_select ON public.empleados FOR SELECT TO dinamic_api USING (true);
DROP POLICY IF EXISTS empleados_dinamic_api_insert ON public.empleados;
CREATE POLICY empleados_dinamic_api_insert ON public.empleados FOR INSERT TO dinamic_api WITH CHECK (true);
DROP POLICY IF EXISTS empleados_dinamic_api_update ON public.empleados;
CREATE POLICY empleados_dinamic_api_update ON public.empleados FOR UPDATE TO dinamic_api USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS asignaciones_dinamic_api_select ON public.asignaciones;
CREATE POLICY asignaciones_dinamic_api_select ON public.asignaciones FOR SELECT TO dinamic_api USING (true);
DROP POLICY IF EXISTS asignaciones_dinamic_api_insert ON public.asignaciones;
CREATE POLICY asignaciones_dinamic_api_insert ON public.asignaciones FOR INSERT TO dinamic_api WITH CHECK (true);
DROP POLICY IF EXISTS asignaciones_dinamic_api_update ON public.asignaciones;
CREATE POLICY asignaciones_dinamic_api_update ON public.asignaciones FOR UPDATE TO dinamic_api USING (true) WITH CHECK (true);

-- Keep SELECT for Phase 3B dependencies; close only browser DML migrated in 3A.
REVOKE INSERT, UPDATE ON public.empleados FROM authenticated, anon;
REVOKE INSERT, UPDATE ON public.asignaciones FROM authenticated, anon;

COMMIT;
