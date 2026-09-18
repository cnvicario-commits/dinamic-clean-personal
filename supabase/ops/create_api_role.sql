-- =============================================================================
-- dinamic_api — Phase 1 least-privilege DB role (SELECT-only on needed tables)
-- =============================================================================
-- Apply on TEST / disposable DBs only until reviewed.
-- Never commit real passwords. Set the password out-of-band after create:
--   ALTER ROLE dinamic_api PASSWORD '<from-secret-store>';
--
-- Idempotent-ish: safe to re-run (IF NOT EXISTS + GRANT is additive).
--
-- Residual risk: this role intentionally does NOT get SELECT on auth.users.
-- loadProfile will skip ban/delete checks when auth.users is not readable
-- (see apps/api/src/infrastructure/db/profiles-repo.ts). Prefer JWKS + short
-- JWT TTL; ban checks remain best-effort until a controlled grant is approved.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dinamic_api') THEN
    CREATE ROLE dinamic_api
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
    -- Password placeholder: set immediately via ALTER ROLE … PASSWORD (never in git).
    RAISE NOTICE 'Created role dinamic_api without password — run ALTER ROLE dinamic_api PASSWORD …';
  ELSE
    RAISE NOTICE 'Role dinamic_api already exists — skipping CREATE ROLE';
  END IF;
END
$$;

-- CONNECT on current database (works regardless of DB name)
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO dinamic_api', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO dinamic_api;

-- Phase 1 vertical slice tables only
GRANT SELECT ON TABLE public.perfiles TO dinamic_api;
GRANT SELECT ON TABLE public.empleados TO dinamic_api;
GRANT SELECT ON TABLE public.asignaciones TO dinamic_api;
GRANT SELECT ON TABLE public.clientes TO dinamic_api;

-- Explicit denials for clarity (optional; default is no privilege)
-- Do NOT grant: auth.users, service_role, ALL TABLES, sequences for writes, etc.

COMMENT ON ROLE dinamic_api IS
  'Dinamic Clean API least-privilege role (Phase 1): SELECT on perfiles/empleados/asignaciones/clientes only';
