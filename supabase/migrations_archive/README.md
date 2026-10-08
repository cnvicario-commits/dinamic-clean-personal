# Migration archive (historical)

These files (`0001`–`0033`, including both `0002_*` variants) are **historical**.

They are already reflected in `supabase/baseline/001_public_schema.sql`.

**Do not** re-apply them on a blank restore. Use:

1. `scripts/restore-development.sh` (baseline 001 → 002 grants → 003 storage → `migrations/forward/`)
2. `BASELINE_CUTOFF=0033`

New schema changes after the baseline cutoff go in `supabase/migrations/forward/` with deterministic lexical names (`0034_...sql`, …).
