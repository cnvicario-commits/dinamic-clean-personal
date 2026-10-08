-- Phase 4A: browser DML closure; API uses the least-privilege dinamic_api role.
BEGIN;

GRANT SELECT, INSERT, UPDATE ON public.clientes TO dinamic_api;
GRANT SELECT, INSERT, UPDATE ON public.cliente_domicilios TO dinamic_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_presupuestos TO dinamic_api;

DROP POLICY IF EXISTS clientes_dinamic_api_select ON public.clientes;
CREATE POLICY clientes_dinamic_api_select ON public.clientes FOR SELECT TO dinamic_api USING (true);
DROP POLICY IF EXISTS clientes_dinamic_api_insert ON public.clientes;
CREATE POLICY clientes_dinamic_api_insert ON public.clientes FOR INSERT TO dinamic_api WITH CHECK (true);
DROP POLICY IF EXISTS clientes_dinamic_api_update ON public.clientes;
CREATE POLICY clientes_dinamic_api_update ON public.clientes FOR UPDATE TO dinamic_api USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS admin_crea_clientes ON public.clientes;
DROP POLICY IF EXISTS admin_edita_clientes ON public.clientes;
DROP POLICY IF EXISTS admin_borra_clientes ON public.clientes;
DROP POLICY IF EXISTS cliente_domicilios_dinamic_api_all ON public.cliente_domicilios;
CREATE POLICY cliente_domicilios_dinamic_api_all ON public.cliente_domicilios FOR ALL TO dinamic_api USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cliente_presupuestos_dinamic_api_all ON public.cliente_presupuestos;
CREATE POLICY cliente_presupuestos_dinamic_api_all ON public.cliente_presupuestos FOR ALL TO dinamic_api USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cliente_domicilios_authenticated_all ON public.cliente_domicilios;
DROP POLICY IF EXISTS cliente_presupuestos_authenticated_all ON public.cliente_presupuestos;
DROP POLICY IF EXISTS presupuestos_clientes_storage_authenticated_all ON storage.objects;
-- Policy names changed across historical environments. Remove any remaining browser
-- policy scoped to this bucket by effective role/expression, not only by known name.
DO $$
DECLARE browser_policy record;
BEGIN
  FOR browser_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public'::name, 'anon'::name, 'authenticated'::name]
      AND (coalesce(qual, '') LIKE '%presupuestos-clientes%'
        OR coalesce(with_check, '') LIKE '%presupuestos-clientes%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', browser_policy.policyname);
  END LOOP;
END
$$;
DROP POLICY IF EXISTS cliente_domicilios_authenticated_select ON public.cliente_domicilios;
CREATE POLICY cliente_domicilios_authenticated_select ON public.cliente_domicilios
  FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.clientes, public.cliente_domicilios, public.cliente_presupuestos FROM anon, authenticated;

-- Reads remain temporarily for legacy Compras/Auditorías consumers. Storage has no browser policy.
COMMIT;
