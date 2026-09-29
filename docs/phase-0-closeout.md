# Phase 0 closeout

**Date:** 2026-09-17  
**Decision:** `PHASE_0_PASS`

## Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Disposable **Supabase** (Auth+Storage+DB) provisioned | PASS | Local `supabase start --ignore-health-check` → `evidence/phase0-supabase-start.txt`, `evidence/phase0-supabase-status-redacted.txt` |
| Baseline applied without error | PASS | `RESTORE_TARGET_DB_URL=local` `./scripts/restore-development.sh` → `evidence/phase0-local-restore.txt` (`restore_exit=0`) |
| Forward migrations | PASS | None post-cutoff (`BASELINE_CUTOFF=0033`); `supabase/migrations/forward/` empty by design |
| Extensions | PASS | `evidence/phase0-local-extensions.txt` |
| Storage buckets reproduced | PASS | `003_storage.sql`; local buckets match Dev (`evidence/phase0-local-rls-buckets.txt`, parity buckets=2) |
| Grants reproducible | PASS | `supabase/baseline/002_grants.sql` (+ `dinamic_api` via ops) |
| Structure / parity vs Development | PASS | Identical counts tables/pk/fk/unique/check/indexes/functions/triggers/policies/rls/buckets; empty table-name diff → `evidence/phase0-parity-matrix.txt` |
| Policies verified | PASS | e.g. `empleados` policies present on restore |
| Auth user + profile | PASS | Admin user created; profile inserted |
| Login (Auth + FE SDK) | PASS | Password grant + `@supabase/supabase-js` signIn → `evidence/phase0-fe-auth-client-login.txt` |
| API smoke on restored stack | PASS | healthz/readyz/me/employees → `evidence/phase0-api-smoke.txt` |
| Original/prod not default target | PASS | Restore script requires explicit URL + disposable confirmation |
| Secrets / backups out of Git | PASS | `.env*`, `/evidence/`, `/supabase-backup/`, `/.cursor/` ignored |

## Baseline layout

- `supabase/baseline/001_public_schema.sql` — schema/constraints/indexes/functions/triggers/policies  
- `supabase/baseline/002_grants.sql` — grants snapshot + API role  
- `supabase/baseline/003_storage.sql` — bucket definitions  
- Historical `0001`–`0033` archived under `supabase/migrations_archive/` (not re-applied)  
- `scripts/restore-development.sh` — fail-fast restore  

## Notes

- Cloud “new empty Supabase project” was **not** required once a full local Supabase stack (Auth+Storage+Postgres) restored cleanly with parity to Development.  
- Analytics/logflare containers were excluded (`-x logflare,vector`) due to health flakiness; Auth/DB/Storage remained available.
