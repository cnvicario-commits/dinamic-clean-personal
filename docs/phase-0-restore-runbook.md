# Phase 0 — Restore runbook (non-production)

**Never** target production without written approval.

## Canonical restore

```bash
# 1) Provision disposable Supabase with Auth + Storage + DB
#    Recommended: local CLI
supabase start --ignore-health-check -x logflare,vector
#    Capture DB URL from `supabase status -o env` (do not commit secrets)

# 2) Extensions (if not already present)
psql "$RESTORE_TARGET_DB_URL" -v ON_ERROR_STOP=1 -c \
  'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pg_trgm;'

# 3) Apply baseline only (historical 0001–0033 are NOT re-applied)
export RESTORE_TARGET_DB_URL='postgresql://…'   # disposable only
export I_CONFIRM_DISPOSABLE=yes                 # required for non-local/prod-like hosts
./scripts/restore-development.sh
```

`BASELINE_CUTOFF=0033` — schema through historical migrations is in `supabase/baseline/001_public_schema.sql`.  
New deltas: `supabase/migrations/forward/*.sql` (lexical order).  
Archive: `supabase/migrations_archive/` (do not re-apply).

## Baseline files

| File | Contents |
|------|----------|
| `001_public_schema.sql` | tables, constraints, indexes, functions, triggers, RLS policies |
| `002_grants.sql` | grants for anon/authenticated/service_role + `\ir` API role |
| `003_storage.sql` | buckets `justificaciones`, `presupuestos-clientes` |

## Auth (manual / scripted)

1. Create confirmed Auth user (dashboard or Admin API).  
2. `insert into public.perfiles (id, nombre_completo, rol) values ('<auth.users.id>', '…', 'admin');`  
3. Login via app or `@supabase/supabase-js` `signInWithPassword`.

## Parity check

Compare structural counts (not only row counts) between Development and restore target — see `evidence/phase0-parity-matrix.txt` template in last PASS cycle.

## Recorded PASS drill (2026-09-17)

Local Supabase restore: **PASS** (`evidence/phase0-local-restore.txt`, parity identical to Development).
