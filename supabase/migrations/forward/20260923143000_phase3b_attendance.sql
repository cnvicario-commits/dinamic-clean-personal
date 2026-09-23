BEGIN;

GRANT SELECT ON TABLE public.asistencias TO dinamic_api;
GRANT INSERT (empleado_id, fecha, codigo, horas_extras, cargado_por, observaciones, archivo_url, cliente_destino_id, cliente_horas_extra_id) ON TABLE public.asistencias TO dinamic_api;
GRANT UPDATE (codigo, horas_extras, cargado_por, observaciones, archivo_url, cliente_destino_id, cliente_horas_extra_id) ON TABLE public.asistencias TO dinamic_api;
GRANT SELECT ON TABLE public.codigos_novedad TO dinamic_api;

DROP POLICY IF EXISTS asistencias_dinamic_api_select ON public.asistencias;
DROP POLICY IF EXISTS asistencias_dinamic_api_insert ON public.asistencias;
DROP POLICY IF EXISTS asistencias_dinamic_api_update ON public.asistencias;
CREATE POLICY asistencias_dinamic_api_select ON public.asistencias FOR SELECT TO dinamic_api USING (true);
CREATE POLICY asistencias_dinamic_api_insert ON public.asistencias FOR INSERT TO dinamic_api WITH CHECK (true);
CREATE POLICY asistencias_dinamic_api_update ON public.asistencias FOR UPDATE TO dinamic_api USING (true) WITH CHECK (true);

GRANT SELECT ON TABLE public.ausencias TO dinamic_api;
DROP POLICY IF EXISTS ausencias_dinamic_api_select ON public.ausencias;
CREATE POLICY ausencias_dinamic_api_select ON public.ausencias FOR SELECT TO dinamic_api USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.asistencias, public.ausencias, public.codigos_novedad FROM anon, authenticated;

COMMIT;
