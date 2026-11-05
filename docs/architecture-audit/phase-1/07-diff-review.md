# 07 — Inventario del diff

Sin cambios de esquema cloud, sin secretos y sin historial Git.

## Runtime de tests

- `apps/api/src/infrastructure/db/connection-target.ts` — clasificación fail-closed.
- `apps/api/src/infrastructure/db/pool.ts` — `createDb` rechaza destinos no locales solo con `NODE_ENV=test`.
- `apps/api/tests/vitest-setup.ts` — neutraliza el entorno o aborta la integración.
- `apps/api/tests/supabase-test-guard.ts` — la integración aceptada es simulación local; el `Pool` de `pg` queda envuelto.
- `apps/api/vitest.config.ts` — registra el setup.
- `apps/api/tests/supabase-test-guard-environment.test.ts` — casos de rechazo y de aceptación local.
- Suites que cargaban `.env` o exigían el ref cloud: `http.integration`, `crm-date-postgres`, `din402-crm`, `ventas-role-smoke`, `supabase-identity`, `profiles-backend-positive`, `postgrest-perfiles-negative`, y los comentarios de las dos de phase 2E.

## CLI, restore y CI

- `supabase/config.toml` — seed desactivado porque `seed.sql` no existe.
- `scripts/restore-development.sh` — solo acepta un loopback; producción, Test, poolers y hosts ambiguos se rechazan sin override; crea `pg_trgm` en `public`; aplica `create_api_role.sql`.
- `scripts/run-ephemeral-integration.sh` — stack local, restore y una suite real.
- `apps/api/scripts/run-integration-with-env.mjs` — exige `USE_LOCAL_SUPABASE=1` y URLs de loopback.
- `.github/workflows/ci.yml` — tests de frontend y job de integración sin privilegios.
- `apps/api/.env.example` — nota de que `npm test` no usa el `.env` cloud.
- `scripts/recon-vps-readonly.sh` — relevamiento de solo lectura, no ejecutado.

## Documentación

`docs/architecture-audit/phase-1/01` a `10`.

## Riesgo del diff

`restore-development.sh` no restaura sobre Test ni sobre producción. El script de migraciones forward no cambió y sigue siendo el único camino previsto para las siete pendientes, después de aprobación y de un backup restaurable.

El job nuevo de CI alarga el pull request: descarga el CLI y levanta Docker. Si el runner de GitHub no puede usar Docker, el job falla y el PR no queda “verde” por omisión.
