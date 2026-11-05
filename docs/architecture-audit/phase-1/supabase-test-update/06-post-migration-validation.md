# Validación posterior

Lecturas contra `edruejzwwnixsjsadbgb` después del exit 0.

## Historial

- 28 filas y 28 nombres distintos.
- El conjunto es exactamente el de `supabase/migrations/forward/`.
- Los 28 checksums coinciden con el SHA-256 de cada archivo. Deriva: ninguna.

## Compras

`purchase_operation_idempotency_operation_check` acepta `purchase_request_import`, `purchase_order_generate`, `purchase_request_create` y `purchase_order_create`. La tabla sigue en 0 filas.

## Tablas nuevas

Existen y están vacías. RLS activo. `anon` y `authenticated` no tienen grants.

`auth_compensation_jobs`: PK `id`; checks de `job_type = delete_orphan_auth_user`, `attempts >= 0` y estado `pending|processing|succeeded|exhausted`; índice único parcial de un pendiente por `auth_user_id`. `dinamic_api`: SELECT, INSERT, UPDATE.

`client_operation_idempotency` y `company_operation_idempotency`: PK `(actor_id, operation, idempotency_key)`; FK a `auth.users` con `ON DELETE CASCADE`; operación `client_create` o `company_create`; clave de 1 a 255; estado `PROCESSING|COMPLETED`. `dinamic_api`: SELECT, INSERT, UPDATE, DELETE.

## Backend

`npm run db:check-compatibility` con `RUN_DB_COMPATIBILITY_CHECK=1` devolvió `db_schema_compatible`, target `test`, project ref `edruejzwwnixsjsadbgb`, `currentUser` `dinamic_api`. La URL de aplicación es pooler, contiene el ref de Test y no contiene el de producción.

API local en `127.0.0.1:3001`, usando el entorno de desarrollo que apunta a Test: `GET /readyz` respondió `200` y `{"status":"ready"}`. El proceso se detuvo después de la prueba. No hay una API publicada de pruebas distinta de esta comprobación local.
