# Matriz E2E 4B

| Funcionalidad | Frontend | API client | Endpoint | Service | Repository | DB | Test |
|---|---|---|---|---|---|---|---|
| Proveedores list/create/edit/status | páginas/forms 4B | generated client | `/v1/suppliers` | catalog-service | catalog-repository | proveedores | catalog-http |
| Artículos list/detail/create/edit/status | páginas/forms 4B | generated client | `/v1/articles` | catalog-service | catalog-repository | articulos | catalog-http + PostgreSQL ART |
| Relaciones | ArticuloProveedoresTabla/forms | generated client | `/v1/articles/:id/suppliers` | catalog-service | catalog-repository | articulos_proveedor | catalog-http + rollback |
| Pendientes list/resolve | pendientes/PendientesTabla | generated client | `/v1/supplier-article-pending` | catalog-service | catalog-repository | pendientes + relación | PostgreSQL rollback |
| Import preview/apply | ImportarArticulos | generated client | `/v1/articles/import[/preview]` | catalog-service | idempotent repository | articulos | preview, idempotency, rollback |
| Lista preview/apply | CargaListaPrecios | generated client | `/v1/price-lists[/preview|apply]` | catalog-service | idempotent repository | relaciones/pendientes | preview, idempotency, rollback |

Las pruebas PostgreSQL usan el rol efectivo `dinamic_api`; la matriz PostgREST prueba la ruta directa y obtiene DENIED.
