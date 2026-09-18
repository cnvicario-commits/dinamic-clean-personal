# Phase 0 — Secrets inventory (names only)

**Never commit values.** Values live in local `.env.local` / host secrets / password manager.

## Frontend (Next.js) — public

| Name | Required | Notes |
|------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Test project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable/anon key (dashboard may label “publishable”) |
| `NEXT_PUBLIC_API_URL` | Phase 1 | Backend base URL for browser/SSR (e.g. `http://localhost:3001`) |

## Frontend / Next server — private

| Name | Required | Notes |
|------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | for `/usuarios` only | Never `NEXT_PUBLIC_*` |
| `API_URL` | Phase 1 SSR | Server-side API base if distinct from public |

## Backend (`apps/api`) — private

| Name | Required | Notes |
|------|----------|-------|
| `DATABASE_URL` | yes | Postgres connection (prefer least-privilege role) |
| `SUPABASE_URL` | yes | Same project URL for JWKS |
| `SUPABASE_JWT_SECRET` | optional* | Legacy HMAC secret if JWKS unavailable |
| `PORT` | no | Default `3001` |
| `HOST` | no | Default `0.0.0.0` |
| `LOG_LEVEL` | no | Default `info` |
| `CORS_ORIGIN` | yes in prod | Comma-separated origins |
| `NODE_ENV` | yes | `development` / `test` / `production` |

\* Prefer JWKS verification via `SUPABASE_URL`; JWT secret is fallback.

## Explicitly out of repo

- `.env*` (gitignored)
- `/backups/`
- `/Referencias/`
- Connection strings pasted in chat (rotate if leaked)

## Default target

Development/test project id: **`edruejzwwnixsjsadbgb`**. Production/original project must not be the default in docs or scripts.
