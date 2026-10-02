-- Phase 6A: server-managed attendance justification paths; close browser Storage on justificaciones.
BEGIN;

ALTER TABLE public.asistencias
  ADD COLUMN IF NOT EXISTS archivo_storage_path text;

COMMENT ON COLUMN public.asistencias.archivo_storage_path IS
  'Private object path in bucket justificaciones; legacy rows may only have archivo_url.';

REVOKE INSERT, UPDATE ON TABLE public.asistencias FROM dinamic_api;

GRANT INSERT (
  empleado_id,
  fecha,
  codigo,
  horas_extras,
  cargado_por,
  observaciones,
  archivo_url,
  archivo_storage_path,
  cliente_destino_id,
  cliente_horas_extra_id
) ON TABLE public.asistencias TO dinamic_api;

GRANT UPDATE (
  codigo,
  horas_extras,
  cargado_por,
  observaciones,
  archivo_url,
  archivo_storage_path,
  cliente_destino_id,
  cliente_horas_extra_id
) ON TABLE public.asistencias TO dinamic_api;

-- Remove browser-facing Storage policies scoped to the justificaciones bucket.
-- Also drop common manual policy names when present (bucket was dashboard-created).
DROP POLICY IF EXISTS justificaciones_storage_authenticated_all ON storage.objects;
DROP POLICY IF EXISTS "justificaciones_authenticated_all" ON storage.objects;
DROP POLICY IF EXISTS justificaciones_authenticated_all ON storage.objects;

DO $$
DECLARE browser_policy record;
BEGIN
  FOR browser_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public'::name, 'anon'::name, 'authenticated'::name]
      AND (
        coalesce(qual, '') LIKE '%justificaciones%'
        OR coalesce(with_check, '') LIKE '%justificaciones%'
        OR coalesce(qual, '') ~* 'bucket_id[\s]*=[\s]*''justificaciones'''
        OR coalesce(with_check, '') ~* 'bucket_id[\s]*=[\s]*''justificaciones'''
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', browser_policy.policyname);
  END LOOP;
END
$$;

-- NOTE: permissive storage.objects policies without bucket scoping (e.g. USING (true))
-- are not dropped here because they would affect other buckets. Those require env-specific
-- review; runtime closure must be verified with integration tests when available.

COMMIT;
