# Migrations

**Historical (0001–0033):** moved to `../migrations_archive/` — already incorporated in `supabase/baseline/001_public_schema.sql`.

**Forward (post-baseline):** add new `.sql` files under `../migrations/forward/` and apply via `scripts/restore-development.sh`.

Do **not** place duplicate historical files here; `supabase start` / CLI would re-apply them incorrectly on a blank project.
