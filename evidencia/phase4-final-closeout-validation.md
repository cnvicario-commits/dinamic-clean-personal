# Validación final Fase 4

| Fase | Dominio | Backend | Frontend migrado | DB | RLS/PostgREST | Transactions | Idempotency | Concurrency | Tests | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| 4A | clientes/domicilios/presupuestos | PASS | PASS | PASS | PASS histórico | PASS histórico | FAIL en corrida opt-in actual | NOT_CERTIFIED | FAIL |
| 4B | catálogo/proveedores | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 4C | compras | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 4D | resultados | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Bloqueante real restante: la integración opt-in 4A de presupuestos falla al crear el fixture de cliente con `Client persistence failed`, por lo que no es válido certificar el cierre transversal aunque 4B–4D estén verdes.

Estado: `PHASE_4_NOT_READY_TO_CLOSE`.
