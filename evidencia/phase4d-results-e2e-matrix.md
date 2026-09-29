# Fase 4D — Matriz E2E

| Funcionalidad | Frontend | API Client | Endpoint | Service | Repository | DB | Test |
|---|---|---|---|---|---|---|---|
| Results list | `/resultados` | `listResults` | GET `/v1/results` | results-service | results-repository | SELECT + RLS | PASS — HTTP/integración |
| Result detail | `/resultados` | `getResult` | GET `/v1/results/:id` | results-service | results-repository | FK detalle | PASS — integración |
| Filters | API client | `listResults(query)` | GET query params | results-service | filtered SQL | PostgreSQL | PASS — query contract/typecheck |
| Import preview | `ImportarResultadosMensuales` | `previewResultsImport` | POST `/import/preview` | results-service | preview read-only | no writes | PASS — integración |
| Import apply | `ImportarResultadosMensuales` | `applyResultsImport` | POST `/import/apply` | results-service | transaction | header/detail | PASS — integración |
| Reimport same period | import UI | apply client | POST apply | results-service | upsert + replace detail | UNIQUE period | PASS — integración |
| Authorization | `/resultados` | bearer client | all endpoints | RBAC | n/a | grants/RLS | PASS — HTTP 401/403 |
| Rollback | import | apply client | POST apply | results-service | transaction | PostgreSQL | PASS — integration |
| Idempotency/retry | import | Idempotency-Key | POST apply | results-service | persistent table | unique actor/key | PASS — integration |
| PostgREST direct denial | n/a | n/a | Supabase REST | n/a | n/a | RLS/grants | PASS — JWT authenticated real |
