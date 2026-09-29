# Fase 4C — Matriz E2E final

| Funcionalidad | Frontend | API Client | Endpoint | Service | Repository | DB | Test ejecutado |
|---|---|---|---|---|---|---|---|
| Pedido list/detail/create/edit | páginas 4C | generado | `/v1/purchase-requests` | purchases-service | purchases-repository | PostgreSQL | PASS — `purchases-http.test.ts`, integración PostgreSQL |
| Items de pedido | formularios 4C | generado | create/update request | purchases-service | purchases-repository | transacción | PASS — integración PostgreSQL: rollback de edición |
| Import preview | importar | generado | `/import/preview` | purchases-service | purchases-repository | read-only | PASS — integración PostgreSQL |
| Import apply | importar | generado | `/import/apply` | purchases-service | purchases-repository | idempotencia/transacción | PASS — integración PostgreSQL: apply + rollback |
| Asignaciones | panel-compras | generado | `/assignments` | purchases-service | purchases-repository | locking/checks | PASS — integración PostgreSQL: concurrencia y sobreasignación |
| OC list/detail/generate | órdenes-compra | generado | `/purchase-orders` | purchases-service | purchases-repository | PostgreSQL | PASS — integración PostgreSQL |
| OC items | formulario OC | generado | create/generate OC | purchases-service | purchases-repository | transacción | PASS — integración PostgreSQL: rollback de items |
| OC estados | botón de estado | generado | purchase-order transition | purchases-service | purchases-repository | `FOR UPDATE`/state machine | PASS — integración PostgreSQL |
| Depósito list/detail/generate | pedidos-deposito | generado | `/warehouse-orders` | purchases-service | purchases-repository | PostgreSQL | PASS — integración PostgreSQL |
| Depósito items | formulario depósito | generado | generate/duplicate warehouse | purchases-service | purchases-repository | transacción | PASS — integración PostgreSQL: rollback de items |
| Depósito estados | botón de estado | generado | warehouse transition | purchases-service | purchases-repository | `FOR UPDATE`/state machine | PASS — integración PostgreSQL |
| Catálogos 4A/4B | pantallas 4C | generado | catalogs endpoints | purchases-service | catálogo repos | PostgreSQL | PASS — DB validation + HTTP/RBAC |
