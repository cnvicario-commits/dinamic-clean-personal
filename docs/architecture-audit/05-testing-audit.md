# 05 — Auditoría de testing y quality gates

No se ejecutó `npm test` ni las suites de integración. Esas suites, con `RUN_SUPABASE_INTEGRATION=1`, escriben en el Postgres indicado por el entorno. El inventario de abajo es de código y de scripts, no una corrida.

## Inventario

| Suite | Ubicación | Comando real | Qué hace hoy | Dependencias | Estado de ejecución en esta auditoría |
|-------|-----------|--------------|--------------|--------------|----------------------------------------|
| Frontend unitario | 3 archivos: `src/lib/api/fetch-all-pages.test.ts`, `src/lib/api/api-client-errors.test.ts`, `src/lib/empresas/company-writes.test.ts` | `npm test` → `vitest run` (`vitest.config.ts` incluye `src/**/*.test.ts`) | Mocks y lógica pura | Node | No ejecutada |
| API | 81 archivos `apps/api/tests/**/*.test.ts` | `npm test` en `apps/api` | Vitest 5, entorno node | Node | No ejecutada |
| Integración / Postgres | 26 rutas con `integration` o `postgres` en el nombre. Opt-in `RUN_SUPABASE_INTEGRATION=1` | No hay script npm dedicado salvo `apps/api/scripts/run-integration-with-env.mjs` | Saltan si el flag no está | Supabase real + `DATABASE_URL` + ref de test | No ejecutada. En CI quedan skipped y el job igual pasa |
| HTTP con DB opcional | `apps/api/tests/http.integration.test.ts` | el mismo `npm test` | Si `DATABASE_URL` y `SUPABASE_URL` están en el proceso, levanta `buildApp` real y pega a `/healthz`, `/readyz`, `/v1/me` | El Postgres del entorno | No ejecutada. Vitest no carga `.env` por sí mismo |
| Framework de auditoría Python | `scripts/audit/**/test_*.py` | `npm run test:audit-framework` | Tests del auditor estático | Python | No ejecutada |
| E2E browser | — | — | No hay Playwright ni Cypress en dependencias | — | `NOT_APPLICABLE` |
| Cobertura | — | no hay script `coverage` ni umbral | No medida | — | `NOT_VERIFIED` |

CI (`.github/workflows/ci.yml`), verificado en el archivo:

- Frontend en push a `main`/`master` y en todo pull request: `npm ci`, `tsc --noEmit`, `npm run lint`, `npm run build`, `check_frontend_npm_audit_gate.py`, un `rg` de secretos. No corre `npm test`.
- API: `npm ci`, lint, typecheck, `npm test`, build, `npm audit --audit-level=critical`.
- Node 22.
- No define `RUN_SUPABASE_INTEGRATION`, `DATABASE_URL` ni service role. Las suites con `describe.skipIf` no corren.
- Push a `cristian-pruebas` no está en `on.push.branches`.

Tiempo de suite: no medido.

### Mocks frente a Postgres real

Pasan con mocks o stubs, cuando se ejecutan: la mayoría de `apps/api/tests` (HTTP inyectado con `buildApp` y `createMockDb`, RBAC, JWT de `jose`, migraciones leídas como texto). Ejemplo: el bloque principal de `http.integration.test.ts` firma tokens y usa un db stub. El segundo `describe` sí abre el pool real, y solo si las variables ya están en el entorno.

Contra Postgres/Supabase real, y solo con flag: compras, CRM, resultados, catálogo, auditorías, perfiles, ciclo de usuarios, concurrencia de último admin, negativos PostgREST por fase. Parte de esas suites llama a `assertDinamicCleanTestTarget()` (`apps/api/tests/supabase-test-guard.ts`), que exige `NODE_ENV=test`, ref de test distinto del de producción y coincidencia de `SUPABASE_URL` / `DATABASE_URL`. Otras, como `purchases-postgres.integration.test.ts`, `results-postgres.integration.test.ts`, `catalog-postgres.integration.test.ts` y `http.integration.test.ts`, solo miran el flag o la presencia de URL. Un shell con `DATABASE_URL` de producción y el flag encendido no está cubierto por todas las suites.

`ventas-role-smoke.integration.test.ts` además pide `RUN_VENTAS_SMOKE=1` y un admin con MFA. No es un gate de CI.

## Auditorías anteriores

Hay markdown de auditoría en la raíz (`dinamic-clean-audit-evidence.md`, `dinamic-clean-production-gates.md`, `dinamic-clean-enterprise-evidence.md`) que describen un repo sin CI, sin Dockerfile y sin tests. Eso quedó desactualizado: hoy existen `.github/workflows/ci.yml`, `apps/api/Dockerfile`, 81 tests de API y el runner de migraciones. No se usan como prueba del estado actual.

Problemas que siguen abiertos, verificados en código:

| Problema | Estado 2026-11-05 |
|----------|-------------------|
| Integración salteada en CI | Sigue. El workflow no exporta el flag |
| Sin base de CI | Sigue. No hay servicio Postgres ni Supabase en el workflow |
| Frontend sin tests en CI | Sigue. Y la suite de frontend es de 3 archivos |
| Cobertura sin número | Sigue. No hay medición, así que no se fija un porcentaje |
| Migraciones pendientes en test | Parcial. Faltan al menos las tres tablas del 2026-10-30 en el proyecto de test. El libro `forward_history` no se leyó |
| Concurrencia | Existe `phase2e-last-admin-concurrency.integration.test.ts`, opt-in, no corre en CI |

Errores HTTP 400/500, permisos y CRUD mutable: hay tests de API con `app.inject` para varios módulos. Cuáles pasan no se afirma porque no se ejecutaron.

## Gates propuestos

### Nivel 1 — push a `cristian-pruebas`

Obligatorio antes de publicar imagen. Si falla, no se hace deploy y sigue la imagen anterior.

- `npm ci` reproducible en raíz y en `apps/api` (hay lockfiles; el workflow de API ya usa el suyo).
- Lint y typecheck de ambos paquetes.
- `npm test` de ambos, sin `RUN_SUPABASE_INTEGRATION` y sin `DATABASE_URL` del proyecto compartido.
- `npm run build` de ambos.
- Scan de secretos ya presente en CI.
- Validar que el env de deploy tiene ref de test y CORS del dominio de pruebas. Fallar si aparece el ref `biectbcujabpjhinouil`.

No bloquean el demo: cobertura, E2E, smoke con MFA, integración larga.

### Nivel 2 — pull request hacia `auditoria-nasser`

Este es el gate de merge. Bloquean desde el primer día, porque ya existen o se pueden correr sin la base compartida:

- Todo el nivel 1.
- Aplicar baseline + forward sobre un Supabase CLI efímero en el job.
- Tests de integración marcados con el guard de ref, apuntando a ese CLI, no a `edruejzwwnixsjsadbgb`.
- Tests de auth (401 sin bearer), RBAC (`require-permission`, `business-rbac`, `permission-engine`) y de rutas HTTP ya escritas con inject.
- `npm run export:contracts` y diff vacío contra `src/lib/api/generated/`, para que el cliente no se desalinee.
- Revisión humana obligatoria. Una aprobación. El autor no se aprueba solo.

Se incorporan después, cuando exista la suite. No bloquean el primer mes:

- E2E de login y un flujo de ventas.
- Umbral de cobertura.
- Smoke de ventas con MFA.
- Negativos PostgREST de todas las fases, una vez el CLI tenga el mismo esquema.

Cobertura: no hay baseline. Fijar 80 % hoy sería un número inventado. El primer paso es publicar el informe de `vitest --coverage` en el PR, sin fallar. Cuando haya un número real del código de `apps/api/src`, el gate pasa a ser: el patch no baja la cobertura de las líneas que toca. El global se discute con ese número encima de la mesa.

### Nivel 3 — promoción a `main`

Sobre el mismo SHA que ya pasó el nivel 2, más:

- Environment `production` con aprobación manual.
- Revisión de la lista de migraciones forward nuevas y del backup.
- `db:check-compatibility` contra producción, en un job que solo el environment `production` puede correr.
- Plan de rollback de la imagen (tag anterior) escrito en el PR.
- Después del deploy: `GET /readyz` del origen de producción y un login de smoke. El pipeline queda en rojo si el health falla, aunque el contenedor esté `Up`.

## Base aislada para integración

| Opción | Fidelidad Supabase | Aísla el demo de Cristian | Recomendación |
|--------|--------------------|---------------------------|---------------|
| Postgres efímero pelado | Esquema SQL sí. Auth, RLS de roles Supabase, Storage y JWKS no | Sí | Insuficiente como único gate |
| `supabase start` en CI | Auth, PostgREST, Storage, RLS, extensiones del CLI | Sí | Opción a implementar |
| Proyecto cloud dedicado | La más cercana a producción | Sí, si nadie más lo usa | Solo si el CLI en Actions no es viable |
| Reusar `Dinamic-Clean-Test-DB` | Es el cloud real de test, hoy detrás de producción en tres tablas | No | Prohibido para CI y para tests locales de escritura |

Los tests que necesitan JWT de Auth se corren contra el CLI. Los que solo necesitan SQL pueden ir al Postgres de ese mismo stack. Limpieza: el job destruye el contenedor. No se usan transacciones compartidas con el demo.

La guardia `assertDinamicCleanTestTarget` tiene que envolver también las suites que hoy solo miran `DATABASE_URL`, antes de declarar el nivel 2 cerrado.
