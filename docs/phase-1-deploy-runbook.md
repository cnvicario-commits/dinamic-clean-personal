# Phase 1 — API deploy runbook (Docker Compose staging/dev)

**Scope:** `apps/api` via Compose. Not Kubernetes. Not production cutover.

## Prerequisites

- Docker Engine + Compose v2
- Node 22+ (for host-side build/test)
- Secrets from password manager (never commit `.env`)

## 1. Install / build (host)

```bash
cd apps/api
cp .env.example .env   # fill DATABASE_URL, SUPABASE_URL, optional JWT secret
npm ci
npm run lint && npm run typecheck && npm test && npm run build
```

## 2. Secrets

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prefer `dinamic_api` role on **test** DB — see `docs/phase-1-db-least-privilege.md` |
| `SUPABASE_URL` | JWKS issuer base |
| `SUPABASE_JWT_SECRET` | Optional HS256 fallback (dev/tests) |
| `CORS_ORIGIN` | Frontend origin |

Mount via Compose `env_file: apps/api/.env` (gitignored). Do **not** `COPY` `.env` into the image.

## 3. Deploy (Compose)

```bash
# from repo root
docker compose -f deploy/docker-compose.api.yml --env-file apps/api/.env up --build -d
```

Optional host port override: `API_HOST_PORT=3001`.

## 4. Verify

```bash
curl -sS -D- http://127.0.0.1:3001/healthz -o /dev/null
curl -sS -D- http://127.0.0.1:3001/readyz -o /dev/null
docker compose -f deploy/docker-compose.api.yml ps
```

Expect `healthz` → 200 for process liveness, and `readyz` → 200 only after the DB contract is
compatible. A missing Phase 3A migration returns 503 `db_schema_incompatible`; the Compose
healthcheck uses `/readyz`, so that image cannot become healthy.

Before deploy, run the read-only gate with explicit environment identity (never infer production
from a hostname):

```bash
RUN_DB_COMPATIBILITY_CHECK=1 \
DB_COMPATIBILITY_TARGET=test \
EXPECTED_SUPABASE_PROJECT_REF="$EXPECTED_SUPABASE_TEST_PROJECT_REF" \
DATABASE_PROJECT_REF="$EXPECTED_SUPABASE_TEST_PROJECT_REF" \
npm run db:check-compatibility
```

The gate checks the four baseline tables, `dinamic_api` role/non-BYPASSRLS, Phase 3A column grants,
RLS, six named policies, and absence of browser INSERT/UPDATE. It is read-only and never runs
migrations automatically. Apply the versioned migration through the approved database deployment
process first, then run the gate and `/readyz` before promoting the image.

Authenticated smoke (token from test Auth session):

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" http://127.0.0.1:3001/v1/me
```

## 5. Restart

```bash
docker compose -f deploy/docker-compose.api.yml restart api
```

## 6. Rollback

1. Stop current: `docker compose -f deploy/docker-compose.api.yml down`
2. Checkout previous known-good commit / image tag
3. `up --build -d` again
4. Re-check `/healthz` and `/readyz`

Compose does not retain DB state (API is stateless). DB rollback is a separate ops concern.

## Related

- Role grants: `supabase/ops/create_api_role.sql`
- Restore drill: `scripts/restore-development.sh` + `docs/phase-0-restore-runbook.md`

## Host Postgres from the container

If the DB is on the Docker host (local Supabase on `127.0.0.1:54322`), use `host.docker.internal` in `DATABASE_URL` (Compose adds `extra_hosts: host.docker.internal:host-gateway`). After `restart api`, re-check `/healthz` and `/readyz` → 200.
