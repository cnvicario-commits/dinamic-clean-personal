# Fase 4A — causa raíz y corrección

## Error reproducido

La integración real `phase4a-quote-idempotency.integration.test.ts` fallaba en `Client persistence failed` al ejecutar `claimQuoteUpload`/`insertQuoteAndCompleteUpload`.

El diagnóstico directo contra PostgreSQL, sin imprimir secretos, mostró inicialmente:

- `42P01`: `relation public.cliente_presupuesto_upload_idempotency does not exist`.
- Después de aplicar esa migration, `42501`: `permission denied for table cliente_presupuestos`.

## Clasificación

`CONFIGURATION_DEFECT`.

El código productivo y el fixture usan un actor válido de `public.perfiles` y un cliente creado en la misma base. La base efectiva no tenía registradas ni aplicadas las migrations forward 4A de clientes y de idempotencia de presupuestos, por lo que faltaban el objeto y los grants runtime requeridos por `dinamic_api`.

## Corrección aplicada

Se ejecutó el runner oficial con `MIGRATIONS_DATABASE_URL` y `--only` para las migrations existentes:

- `20260928120000_phase4a_clients.sql`
- `20260928130000_phase4a_quote_upload_idempotency.sql`

No se modificaron migrations históricas ni se relajaron RLS, grants browser, FKs o constraints. El modo `--only` fue necesario porque el recorrido completo se detiene antes en la migration histórica `0001_phase2d_perfiles_hardening.sql`, que contiene `ALTER ROLE`, operación que Supabase administrado rechaza.

También se ajustó únicamente el timeout de los tests opt-in de integración para tolerar la latencia real de Supabase; no cambia la lógica ni la garantía probada.

## Verificación

La integración real terminó `2/2 PASS`, incluyendo concurrencia same-key, replay, payload mismatch, Storage y limpieza. Las migrations 4A figuran en `app_migrations.forward_history` y el runtime continúa conectándose como `dinamic_api`.
