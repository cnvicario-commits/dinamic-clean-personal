-- =============================================================================
-- Phase 2D — SAFE rollback (application-compatible)
-- =============================================================================
-- Location: supabase/migrations/rollback/ — NOT auto-applied by restore-development.sh
--
-- Reverts dinamic_api write grants + policies so the API returns to
-- pre-2D pool behavior (SELECT-only on perfiles for dinamic_api).
-- Does NOT restore destructive privileges to anon/authenticated.
--
-- EMERGENCY historical grant restore (TRUNCATE/DELETE/etc. to anon) is NOT here.
-- See: supabase/migrations/rollback/EMERGENCY_0001_phase2d_historical_grants.sql
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS perfiles_dinamic_api_select ON public.perfiles;
DROP POLICY IF EXISTS perfiles_dinamic_api_insert ON public.perfiles;
DROP POLICY IF EXISTS perfiles_dinamic_api_update ON public.perfiles;

REVOKE ALL ON TABLE public.perfiles FROM dinamic_api;
GRANT SELECT ON TABLE public.perfiles TO dinamic_api;

-- Keep authenticated SELECT; do not re-grant INSERT/UPDATE/DELETE/TRUNCATE
GRANT SELECT ON TABLE public.perfiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.perfiles FROM authenticated;

-- anon remains without privileges on perfiles
REVOKE ALL ON TABLE public.perfiles FROM anon;

COMMENT ON ROLE dinamic_api IS
  'Dinamic Clean API role: SELECT on slice tables. Perfiles writes require Phase 2D migration.';

COMMIT;
