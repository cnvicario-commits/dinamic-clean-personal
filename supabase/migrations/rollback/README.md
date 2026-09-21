# Rollback migrations (NOT auto-applied)

Files in this directory are **never** applied by `scripts/restore-development.sh`.

That script only runs `supabase/migrations/forward/*.sql` (excluding `*.rollback.sql`).

Use manually:

```bash
psql "$TEST_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/rollback/0001_phase2d_perfiles_hardening.sql
```

`EMERGENCY_*` scripts restore historical insecure grants — human approval required.
