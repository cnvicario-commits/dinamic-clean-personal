# @dinamic-clean/api

Fastify enterprise API — Phase 1 foundation.

## Run

```bash
cp .env.example .env   # fill DATABASE_URL + SUPABASE_URL
npm install
npm run dev            # http://127.0.0.1:3001
```

## Scripts

- `npm run lint` — ESLint (`apps/api/eslint.config.mjs`)
- `npm run typecheck` — `tsc --noEmit`
- `npm test`
- `npm run build`
- `npm run db:check-compatibility` — read-only deployment DB contract gate; requires explicit target/project variables
- `npm start`
- `npm run export:contracts` — generate typed client under `src/lib/api/generated/`

## Auth / JWT

Verification is cryptographic via **jose** (signature + `iss` + `aud` + `exp`):

1. **Primary:** JWKS at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
2. **Optional fallback:** HS256 with `SUPABASE_JWT_SECRET` when JWKS fails (local/tests, legacy HMAC projects)

Prefer JWKS in production. The secret must never appear in `NEXT_PUBLIC_*` or git.

## Profile revocation

`public.perfiles` has **no** `activo` column. `loadProfile` loads the row and, when the DB role can `SELECT auth.users`, fails closed on missing / banned (`banned_until`) / deleted (`deleted_at`) users. Role `dinamic_api` does **not** get `auth.users` (Phase 1); residual risk remains (documented in `profiles-repo.ts`).

## DB least privilege

Connect as `dinamic_api` on **test** — see `docs/phase-1-db-least-privilege.md` and `supabase/ops/create_api_role.sql`. Do not switch production without change control. Never put credentials in evidence dumps.

## Deploy (Compose)

See `docs/phase-1-deploy-runbook.md` and `deploy/docker-compose.api.yml`.

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /openapi.json`
- `GET /v1/me` (Bearer)
- `GET /v1/employees?page=&pageSize=&activo=` (Bearer + employees:read)

All responses include `X-Request-Id` (= Fastify `request.id`).

## Shutdown

`SIGTERM` / `SIGINT` trigger a single graceful shutdown: stop accepting, close Fastify + DB pool. If not finished within `SHUTDOWN_TIMEOUT_MS` (default 10000), the process exits with code 1.
