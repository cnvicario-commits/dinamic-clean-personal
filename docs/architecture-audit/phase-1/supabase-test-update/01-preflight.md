# Preflight — Supabase Test

Fecha: 2026-11-05. Destino autorizado para una escritura futura: `edruejzwwnixsjsadbgb`. Producción `biectbcujabpjhinouil` no se usó.

## Identidad de conexión

El runner `scripts/apply-forward-migrations.sh` lee `MIGRATIONS_DATABASE_URL`. Si no está exportada, toma solo esa clave de `apps/api/.env` y no evalúa el resto del archivo.

`scripts/assert-migration-target.mjs` clasifica la URL antes de cualquier `psql`. Imprime clase, host, rol y puerto. No imprime la URL ni la contraseña.

Resultado al leer la clave local:

- `MIGRATION_TARGET test-cloud`
- `host_class pooler`
- `role postgres`
- `port 5432`
- base `postgres`

La aceptación exige las tres condiciones: el ref `edruejzwwnixsjsadbgb` está en la URL, el host es `db.<ref>.supabase.co` o un pooler cuyo usuario contiene ese ref, y la base es `postgres`. `biectbcujabpjhinouil` se rechaza siempre. Un host de Supabase sin ese ref se rechaza como nube no identificada. Un loopback solo se acepta con `DINAMIC_MIGRATION_TARGET=disposable-local`, y un loopback que además contiene el ref de Test se rechaza.

`npm run dev` no llama a este runner. El guardia no cambia el destino de desarrollo.

Prueba ejecutada: `npx vitest run tests/migration-target-guard.test.ts` en `apps/api`. 5 tests, exit 0.

## Inventario de lectura en Test

Consulta de solo lectura contra `edruejzwwnixsjsadbgb` el 2026-11-05, después del ensayo local:

| Dato | Valor |
| --- | --- |
| `app_migrations.forward_history` | 21 |
| Prefijo del repositorio (28 archivos) | sí |
| Checksums distintos al archivo | ninguno |
| Archivos aplicados fuera del repositorio | ninguno |
| Usuarios Auth | 15 |
| `perfiles` | 15 |
| `empresas` | 3 |
| `clientes` | 113 |
| `empleados` | 265 |
| `pedidos_compra` | 10 |
| `ordenes_compra` | 5 |
| `crm_leads` | 0 |
| `purchase_operation_idempotency` | 0 filas |

Tablas ausentes: `auth_compensation_jobs`, `client_operation_idempotency`, `company_operation_idempotency`.

Constraint actual de `purchase_operation_idempotency`: solo `purchase_request_import` y `purchase_order_generate`.

`empresas` hoy: `anon` y `authenticated` tienen SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES y TRIGGER. `dinamic_api` tiene solo SELECT.

`dinamic_api`: login, no superusuario, sin `BYPASSRLS`.

Storage: buckets privados `justificaciones` y `presupuestos-clientes`. `storage.objects` = 5. Los bytes de esos objetos no se listaron.

Las siete pendientes, en orden léxico, siguen siendo las nombradas en la fase anterior. No hay huecos intermedios.
