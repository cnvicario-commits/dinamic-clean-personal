-- =============================================================================
-- EMERGENCY / HISTORICAL RESTORE — DO NOT RUN casually
-- =============================================================================
-- Restores baseline-style destructive table privileges for authenticated/anon
-- on public.perfiles (as in supabase/baseline/002_grants.sql).
--
-- Requires explicit human approval. Not applied by any automation.
-- Prefer the safe rollback: 0001_phase2d_perfiles_hardening.sql in this folder.
-- =============================================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.perfiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.perfiles TO anon;

COMMIT;
