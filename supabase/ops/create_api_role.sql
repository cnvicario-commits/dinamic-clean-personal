-- =============================================================================
-- dinamic_api — role bootstrap (NO Phase 2D write grants here)
-- =============================================================================
-- Creates/normalizes role attributes + Phase 1 SELECT grants only.
-- Phase 2D INSERT/UPDATE column grants + RLS policies live ONLY in:
--   supabase/migrations/forward/0001_phase2d_perfiles_hardening.sql
--
-- Running this script alone must NOT leave write grants without policies.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dinamic_api') THEN
    CREATE ROLE dinamic_api LOGIN;
    RAISE NOTICE 'Created role dinamic_api without password — run ALTER ROLE dinamic_api PASSWORD …';
  ELSE
    RAISE NOTICE 'Role dinamic_api already exists — normalizing attributes';
  END IF;
END
$$;

-- Desired state always (idempotent) — LOGIN retained for DATABASE_URL
ALTER ROLE dinamic_api
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO dinamic_api', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO dinamic_api;

-- Phase 1 SELECT-only on vertical slice (no INSERT/UPDATE here)
GRANT SELECT ON TABLE public.perfiles TO dinamic_api;
GRANT SELECT ON TABLE public.empleados TO dinamic_api;
GRANT SELECT ON TABLE public.asignaciones TO dinamic_api;
GRANT SELECT ON TABLE public.clientes TO dinamic_api;

-- Phase 3A write grants are intentionally not bootstrapped here. They are
-- applied only by migrations/forward/0002_phase3a_core_hr.sql together with RLS.

-- Ensure no intermediate write grants without 2D policies
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.perfiles FROM dinamic_api;
GRANT SELECT ON TABLE public.perfiles TO dinamic_api;

COMMENT ON ROLE dinamic_api IS
  'Dinamic Clean API role: LOGIN + least privilege. SELECT on slice tables. Perfiles writes only after Phase 2D migration. No BYPASSRLS.';
