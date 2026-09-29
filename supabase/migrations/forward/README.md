# Forward migrations (post-baseline)

`supabase/baseline/001_public_schema.sql` incorporates historical migrations
**0001–0033** (and the rest of the public schema as of the Phase 0 dump).

- **Do not** re-apply `supabase/migrations/0001_*.sql` … `0033_*.sql` on restore.
- Put **new** schema changes here as numbered SQL files, e.g. `0001_description.sql`.
- `scripts/restore-development.sh` applies `*.sql` in this folder in lexical order after baseline + grants
  (excludes `*.rollback.sql`). Rollbacks live under `supabase/migrations/rollback/` (not auto-applied).

Historical files under `supabase/migrations/` are kept for audit history only.

For an existing development database, apply pending forward migrations without
replaying the baseline:

`./scripts/apply-forward-migrations.sh`

The runner uses `MIGRATIONS_DATABASE_URL`: export it in CI/CD as a
deployment-only secret, or set it in the ignored `apps/api/.env` for local
development. It never uses the API runtime `DATABASE_URL`.

`RESTORE_TARGET_DB_URL` remains exclusive to `scripts/restore-development.sh`:
it identifies a disposable restore target and is not an alias for the
administrative deployment connection.

The runner records filename + checksum in `app_migrations.forward_history` and
fails if an already-applied file changes.

Duplicate historical names (`0002_compras_numeracion.sql` and `0002_proveedor_habitual.sql`)
are already folded into the baseline dump — restores never re-run them.
