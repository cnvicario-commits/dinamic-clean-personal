# Fase 4B — validación final

## Resultado

`READY_FOR_PHASE_4B_FINAL_REVIEW`

## Correcciones verificadas

- Migraciones aplicadas realmente por runner incremental y registradas en `app_migrations.forward_history`.
- Secuencia y trigger ART existen en PostgreSQL; ocho altas concurrentes produjeron códigos únicos con formato histórico.
- Idempotencia persistida en `catalog_operation_idempotency`: retry, respuesta perdida, concurrencia y payload incompatible probados contra DB real.
- Frontend conserva `Idempotency-Key` hasta éxito; cambiar archivo/proveedor crea una nueva key.
- Import de artículos y lista de precios separan preview de apply. Preview no escribió; apply revalida y usa transacción.
- Lista de precios conserva normalización, matching por código proveedor/código interno, deduplicación última-fila-gana, pendientes y sugerencias.
- `authenticated` sólo conserva SELECT legacy; `dinamic_api` ejecuta DML backend. PostgREST directo fue rechazado para roles funcionales y anon.
- Pantallas propias de 4B usan cliente API tipado; sólo quedan lecturas legacy 4C.
- OpenAPI, cliente y tipos fueron regenerados; typechecks PASS.

## Evidencia de ejecución

Backend: lint, typecheck, build y 227 tests PASS. Frontend: lint, typecheck y build webpack PASS. PostgreSQL/PostgREST local: 10 tests PASS. `git diff --check` PASS.

## Hallazgos anteriores

RESOLVED: migración no aplicada, grants abiertos, ART sin protección DB, keys nuevas por submit, preview ausente, lecturas UI directas, contrato OpenAPI incompleto y tests RBAC desactualizados.

## Limitaciones/deuda

Las lecturas de Compras/Depósito permanecen por alcance 4C. No se agrega historial de precios ni UNIQUE proveedor-artículo general porque no están demostrados por el schema. La prueba E2E visual no se ejecuta en navegador; el flujo API/DB y contratos sí se validaron.
