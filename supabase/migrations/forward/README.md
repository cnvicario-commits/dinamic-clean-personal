# Forward migrations (post-baseline)

`supabase/baseline/001_public_schema.sql` incorporates historical migrations
**0001–0033** (and the rest of the public schema as of the Phase 0 dump).

- **Do not** re-apply `supabase/migrations/0001_*.sql` … `0033_*.sql` on restore.
- Put **new** schema changes here as numbered SQL files, e.g. `0001_description.sql`.
- `scripts/restore-development.sh` applies `*.sql` in this folder in lexical order after baseline + grants.

Historical files under `supabase/migrations/` are kept for audit history only.

Duplicate historical names (`0002_compras_numeracion.sql` and `0002_proveedor_habitual.sql`)
are already folded into the baseline dump — restores never re-run them.
