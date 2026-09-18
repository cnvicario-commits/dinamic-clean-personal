# Phase 1 — PostgREST / RLS residual gap (empleados)

## Confirmed gap

| Path | Effect |
|------|--------|
| Fastify `GET /v1/employees` | RBAC: `employees:read` → **admin, gerente** only |
| PostgREST `empleados` SELECT | RLS allows **any `authenticated`** user |

## Phase 1 decision

**Do not** redesign global RLS in Phase 1 (breaks unmigrated UI that still uses Supabase client).

Status: **PENDING_PHASE_2** (or later strangler slice) to close the bypass once FE mutations/list paths no longer depend on direct PostgREST SELECT.

## Close criteria (later)

1. All employee list/read UI uses API only.
2. Migration tightens `empleados` SELECT to roles that match API RBAC (or deny authenticated default).
3. Negative PostgREST test unskipped and green.

See `apps/api/tests/postgrest-employees-rls.negative.test.ts` (intentionally skipped until then).
