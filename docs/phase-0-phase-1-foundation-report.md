# Phase 0 / Phase 1 foundation — closure report

**Date:** 2026-09-17  

## FASE 0

**Decision: `PHASE_0_PASS`**

See `docs/phase-0-closeout.md` and `docs/phase-0-restore-runbook.md`.

Evidence anchors: `evidence/phase0-parity-matrix.txt`, `evidence/phase0-local-restore.txt`, `evidence/phase0-fe-auth-client-login.txt`, `evidence/phase0-api-smoke.txt`.

---

## FASE 1

**Decision: `PHASE_1_BLOCKED`**

### Criteria

| Criterion | Status | Evidence / note |
|-----------|--------|-----------------|
| Modular backend | PASS | `apps/api` layered |
| JWT Supabase verified (real) | PASS | Local ES256 JWKS login → `/v1/me` 200; invalid → 401 |
| Profile loading | PASS | `loadProfile` + residual Auth risk when no `auth.users` |
| RBAC deny-by-default | PASS | Unit + smoke: compras → employees **403** (`evidence/phase1-rbac-deny-smoke.txt`) |
| DTO/Zod validation | PASS | Strict query schema |
| Problem Details | PASS | |
| Request ID | PASS | `X-Request-Id` observed |
| Structured logs | PASS | Pino |
| healthz / readyz | PASS | |
| CORS / timeout / graceful shutdown | PASS | Docker restart showed SIGTERM shutdown |
| OpenAPI + drift test | PASS | `tests/openapi.contract.test.ts` |
| **TypeScript client generated** | PASS | `src/lib/api/generated/*` via `npm run export:contracts` (deterministic) |
| `/v1/me` + `/v1/employees` | PASS | |
| Frontend piloto | PASS | Uses generated client; build PASS |
| API lint (real ESLint) | PASS | `apps/api` eslint exit 0 |
| API typecheck / test / build / audit | PASS | All exit 0 |
| FE typecheck | PASS | |
| FE build | PASS | After extensionless generated imports |
| FE lint | **FAIL** | 24 pre-existing errors outside piloto (`evidence/fe-lint.txt`) |
| FE audit critical | **FAIL** | Next advisories (`evidence/fe-audit.txt`) |
| Secret scan | PASS | Local scan exit 0 |
| DB least-privilege role | PASS | `dinamic_api` SELECT-only on slice; `current_user=dinamic_api` (`evidence/phase1-api-role-*`) |
| Backend staging deploy | PASS | Docker Compose local staging; healthz+readyz 200 before/after restart (`evidence/phase1-docker-health.txt`) |
| Deploy runbook | PASS | `docs/phase-1-deploy-runbook.md` |
| **CI real GREEN** | **FAIL** | `gh auth status` exit 1 — no GitHub Actions run evidence (`evidence/phase1-gh-auth.txt`) |
| PostgREST empleados bypass closed | N/A | **PENDING_PHASE_2** (documented) |

### Why BLOCKED

Mandatory gates **FE lint**, **FE audit --audit-level=critical**, and **CI GREEN** did not pass. Per instructions: do not declare Phase 1 PASS when an obligatory criterion fails.

---

## PENDING_PHASE_2

- Global RLS redesign / close PostgREST `empleados` SELECT bypass  
- Global grants redesign  
- MFA / password policy / recovery  
- Rate limiting transversal / security headers complete  
- Audit log append-only  
- Full users/profiles lifecycle & revocation productization  
- Final client RBAC matrix  
- FE legacy lint/`any` cleanup across non-piloto modules  
- Dependency upgrades for Next critical advisories  
- Authenticated GitHub Actions GREEN on remote  

---

## READY_FOR_PHASE_2_REVIEW

**NO** — blocked by Phase 1 failures above. Do **not** start Phase 2 until external review and explicit user authorization after `PHASE_1_PASS`.
