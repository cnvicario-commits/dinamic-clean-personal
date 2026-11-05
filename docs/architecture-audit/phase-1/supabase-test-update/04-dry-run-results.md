# Ensayo sobre la copia restaurada

Destino: `127.0.0.1:55432`, con `DINAMIC_MIGRATION_TARGET=disposable-local`. El guardia imprimió `MIGRATION_TARGET disposable-local`, rol `postgres`, puerto `55432`.

Comando: `./scripts/apply-forward-migrations.sh`.

Salida relevante: `forward_history 21 pending 7`. Marcó las 21 como ya aplicadas y aplicó las siete, en orden, con exit 0.

Avisos esperados: políticas y un trigger que el SQL elimina con `IF EXISTS` y que la copia no tenía. No hubo error de constraint ni de FK en las tablas nuevas.

## Resultado en la copia

- `forward_history`: 28 filas, sin nombres duplicados, checksums idénticos a los 28 archivos del repositorio (`drift` vacío).
- Check de `purchase_operation_idempotency`: `purchase_request_import`, `purchase_order_generate`, `purchase_request_create`, `purchase_order_create`.
- Existen `auth_compensation_jobs`, `client_operation_idempotency` y `company_operation_idempotency`.
- Grants de `empresas` en la copia: `dinamic_api` SELECT, INSERT, UPDATE; `authenticated` solo SELECT; `anon` sin filas en `role_table_grants`.
- `dinamic_api`: no superusuario, sin `BYPASSRLS`, con login.
- Conteos después del ensayo: Auth 15, perfiles 15, empresas 3, clientes 113, empleados 265, pedidos 10, órdenes 5, leads 0.

Consulta posterior a Test cloud: el historial sigue en 21, Auth 15, perfiles 15. El ensayo no escribió en `edruejzwwnixsjsadbgb`.

El contenedor se eliminó al cerrar el ensayo. El dump sigue en el directorio de backup.
