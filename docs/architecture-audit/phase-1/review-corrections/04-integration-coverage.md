# 04 — Cobertura de integración

`npm test` de la API sigue omitiendo 80 pruebas. Ninguna de esas 80 es unitaria: todas están detrás de `RUN_SUPABASE_INTEGRATION` u otra variable de opt-in. Omitirlas en el job unitario es correcto.

El job efímero ahora ejecuta, y pasó, 20 pruebas en tres archivos:

| Archivo | Pruebas que antes se omitían | Por qué entran |
|---------|------------------------------|----------------|
| `http.integration.test.ts` | 3 | health, readiness y 401 sobre Postgres local |
| `crm-date-postgres.integration.test.ts` | 1 | un `select` de fechas, sin filas previas |
| `postgrest-phase4b-rls.negative.test.ts` | 2 | JWT firmado con el secreto local; espera 401 o 403 |

El mismo archivo HTTP aporta otras 14 pruebas que ya corrían sin base. El total del job es 20.

## Probada y dejada afuera

`results-postgres.integration.test.ts` (3) se ejecutó una vez contra el CLI. Dos pruebas pasaron. La tercera espera `statusCode` 502 y la base local respondió 409 (`The record conflicts with an existing one`). No se modificó la aserción ni el repositorio. No entra al job.

## Pendiente para la fase 6

PostgreSQL que necesita filas o un libro de migraciones que el restore no escribe:

| Archivo | Omitidas | Qué falta |
|---------|----------|-----------|
| `catalog-postgres.integration.test.ts` | 8 | un perfil actor |
| `purchases-postgres.integration.test.ts` | 8 | empresa, cliente, artículo, proveedor y perfil activos |
| `din402-crm.integration.test.ts` | 6 | dos perfiles |
| `audits-postgres.integration.test.ts` | 5 | perfil, domicilio y plantilla activa |
| `purchases-db-validation.integration.test.ts` | 4 | `app_migrations.forward_history` con checksums; el restore aplica SQL y no registra esa tabla |
| `results-postgres.integration.test.ts` | 3 | decidir si el conflicto duplicado es 409 o 502 |

Auth, RLS y PostgREST que necesitan un usuario real, un JWT de browser o un id de perfil:

| Archivo | Omitidas |
|---------|----------|
| `postgrest-phase4a-rls.negative.test.ts` | 12 |
| `postgrest-employees-rls.negative.test.ts` | 4 |
| `postgrest-perfiles-negative.integration.test.ts` | 4 |
| `ventas-role-smoke.integration.test.ts` | 3 |
| `postgrest-phase5b-audits-rls.negative.test.ts` | 2 |
| `postgrest-phase6a-rls.negative.test.ts` | 2 |
| `profiles-backend-positive.integration.test.ts` | 2 |
| `postgrest-phase4c-rls.negative.test.ts` | 1 |
| `phase2e-lifecycle.integration.test.ts` | 1 |
| `supabase-identity.integration.test.ts` | 1 |

Concurrencia y configuración especial:

| Archivo | Omitidas | Qué falta |
|---------|----------|-----------|
| `phase2e-last-admin-concurrency.integration.test.ts` | 3 | exactamente dos admins activos |
| `phase4a-quote-idempotency.integration.test.ts` | 2 | storage y URL de admin |
| `phase3a-core-hr.integration.test.ts` | 2 | `PHASE3A_TEST_CLIENT_ID` |
| `phase2e-demotion-rollback.integration.test.ts` | 1 | Auth Admin y el flujo de rol |

Esas 74 no se apuntan al CLI en esta corrección. Ninguna toca Supabase Test ni producción.
