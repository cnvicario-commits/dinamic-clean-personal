-- =============================================================================
-- Phase 2D — perfiles hardening (identity / users module)
-- =============================================================================
-- Sole source of dinamic_api perfiles WRITE privileges + RLS policies.
-- create_api_role.sql must be applied first (role + SELECT only).
--
-- Model (deliberate):
--   shared backend role dinamic_api
--   + Fastify primary authorization
--   + column-level grants + RLS policies TO dinamic_api (USING/WITH CHECK true)
--   as defense-in-depth — NOT BYPASSRLS, NOT service-role table writes.
--
-- Rollback (manual, not auto-applied):
--   supabase/migrations/rollback/0001_phase2d_perfiles_hardening.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Security preconditions — fail closed
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rls_on boolean;
  is_owner boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'perfiles' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Phase 2D precondition failed: public.perfiles does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dinamic_api') THEN
    RAISE EXCEPTION 'Phase 2D precondition failed: role dinamic_api missing — run supabase/ops/create_api_role.sql first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'dinamic_api' AND rolsuper
  ) THEN
    RAISE EXCEPTION 'Phase 2D precondition failed: dinamic_api must not be superuser';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'dinamic_api' AND rolbypassrls
  ) THEN
    RAISE EXCEPTION 'Phase 2D precondition failed: dinamic_api must not have BYPASSRLS';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'public' AND c.relname = 'perfiles' AND r.rolname = 'dinamic_api'
  ) INTO is_owner;

  IF is_owner THEN
    RAISE EXCEPTION 'Phase 2D precondition failed: dinamic_api must not own public.perfiles';
  END IF;

  SELECT c.relrowsecurity INTO rls_on
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'perfiles';

  IF NOT COALESCE(rls_on, false) THEN
    EXECUTE 'ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

-- Normalize role attributes again (defense against drift)
ALTER ROLE dinamic_api
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

-- ---------------------------------------------------------------------------
-- 1) Column-level grants for dinamic_api (no DELETE, no UPDATE on id/created_at)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.perfiles FROM dinamic_api;
GRANT SELECT ON TABLE public.perfiles TO dinamic_api;
GRANT INSERT (id, nombre_completo, rol) ON TABLE public.perfiles TO dinamic_api;
GRANT UPDATE (nombre_completo, rol) ON TABLE public.perfiles TO dinamic_api;

COMMENT ON ROLE dinamic_api IS
  'Dinamic Clean API (Phase 2D): SELECT slice; INSERT(id,nombre_completo,rol)/UPDATE(nombre_completo,rol) on perfiles. No BYPASSRLS.';

-- ---------------------------------------------------------------------------
-- 2) RLS policies for dinamic_api
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS perfiles_dinamic_api_select ON public.perfiles;
CREATE POLICY perfiles_dinamic_api_select ON public.perfiles
  FOR SELECT TO dinamic_api
  USING (true);

DROP POLICY IF EXISTS perfiles_dinamic_api_insert ON public.perfiles;
CREATE POLICY perfiles_dinamic_api_insert ON public.perfiles
  FOR INSERT TO dinamic_api
  WITH CHECK (true);

DROP POLICY IF EXISTS perfiles_dinamic_api_update ON public.perfiles;
CREATE POLICY perfiles_dinamic_api_update ON public.perfiles
  FOR UPDATE TO dinamic_api
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) Revoke PostgREST DML from browser-facing roles
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.perfiles FROM authenticated;

REVOKE ALL ON TABLE public.perfiles FROM anon;

GRANT SELECT ON TABLE public.perfiles TO authenticated;

COMMIT;
