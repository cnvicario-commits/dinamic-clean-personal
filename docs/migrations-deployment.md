# Migrations and database connections

## Connection model

`DATABASE_URL` is the Fastify runtime connection. It must use the
least-privilege `dinamic_api` role and is the only PostgreSQL connection read
by `apps/api` at runtime.

`MIGRATIONS_DATABASE_URL` is a deployment-only administrative connection. The
forward migration job consumes it; the API runtime must not receive or depend
on it. CI/CD injects it only for `./scripts/apply-forward-migrations.sh`.
The local Compose definition explicitly clears the variable even when its
`env_file` is reused for developer convenience.

For local development, the forward migration runner reads only the exact
`MIGRATIONS_DATABASE_URL` key from ignored `apps/api/.env` when it is not
already exported. It does not source that file or print the value. An exported
CI/CD value always takes precedence.

`RESTORE_TARGET_DB_URL` remains separate. It is the deliberately disposable
target of `scripts/restore-development.sh`, which restores the baseline,
grants, storage, and all forward migrations. Its production-target guard does
not apply to a normal deployment migration connection.

## Forward migration history

`scripts/apply-forward-migrations.sh` creates, if needed,
`app_migrations.forward_history`. Each migration is processed in lexical
filename order and records its filename, SHA-256 checksum, and application
time. A recorded matching checksum is skipped; checksum drift stops the run.
Each migration and its history insert share a transaction, so a failed
migration is not recorded.

## Managed Supabase role-operation blocker

`supabase/migrations/forward/0001_phase2d_perfiles_hardening.sql` normalizes
`dinamic_api` with `ALTER ROLE` before applying its column grants and RLS
policies. The role bootstrap in `supabase/ops/create_api_role.sql` contains
the same managed-role operation. On the current hosted Supabase project, the
managed `postgres` connection is not a PostgreSQL superuser and rejects that
operation. The forward runner therefore stops before applying `0001`.

This is intentionally not bypassed or skipped by the runner: skipping it
would silently omit the Phase 2D grants and RLS policy changes, while editing
an already-versioned migration would invalidate checksum history. A compatible
deployment policy for hosted Supabase must be agreed before resolving it: use
a provider-supported role-management channel or introduce a separately
reviewed, managed-Supabase-compatible Phase 2D migration plan. Until then,
the runner remains fail-closed at that migration; already-recorded Phase 4B
migrations are not reapplied.
