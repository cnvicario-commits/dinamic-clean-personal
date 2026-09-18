# Phase 1 — DB least privilege (`dinamic_api`)

## Goal

API connects as a dedicated role with **SELECT only** on tables needed for the
Phase 1 vertical slice: `perfiles`, `empleados`, `asignaciones`, `clientes`.

## Apply on TEST (not production)

1. Obtain a privileged connection URL for the **test** project (password manager).
2. Set a strong password for the role (do not put it in git):

```bash
psql "$TEST_ADMIN_DB_URL" -v ON_ERROR_STOP=1 -f supabase/ops/create_api_role.sql
psql "$TEST_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE dinamic_api PASSWORD '${DINAMIC_API_DB_PASSWORD}'"
```

3. Point `apps/api/.env` `DATABASE_URL` at the new role:

```text
DATABASE_URL=postgresql://dinamic_api:PASSWORD@HOST:5432/postgres
```

4. Verify:

```sql
select current_user;  -- expect dinamic_api
select has_table_privilege('dinamic_api', 'public.empleados', 'select'); -- t
select has_table_privilege('dinamic_api', 'public.empleados', 'insert'); -- f
```

5. Smoke: `GET /readyz`, `GET /v1/me`, `GET /v1/employees` with a valid JWT.

## Residual risk (auth.users)

`dinamic_api` does **not** receive `SELECT` on `auth.users`. Profile loading
still works from `public.perfiles`; ban/delete checks are skipped when
`auth.users` is not readable. Documented in `profiles-repo.ts`. Do not widen
grants without an explicit security review.

## Production

**Do not** switch production connection strings until this role is reviewed and
applied under change control. Keep using the current test URL until then.
