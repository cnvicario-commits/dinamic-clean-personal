# Grants y RLS

## Test cloud, antes de migrar

`empresas`:

- `dinamic_api`: SELECT.
- `authenticated` y `anon`: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.

Políticas: `empresas_dinamic_api_select`, `empresas_select_all_logged`, `empresas_insert_admin`, `empresas_update_admin`.

`dinamic_api` no es superusuario y no tiene `BYPASSRLS`.

RLS activo no cierra `TRUNCATE` ni un grant directo. Por eso el cierre pedido es el `REVOKE` del archivo `20261030140000`.

## Copia, después del ensayo

`information_schema.role_table_grants` sobre `empresas`:

- `dinamic_api`: SELECT, INSERT, UPDATE.
- `authenticated`: SELECT.
- `anon`: ningún privilegio listado.

Políticas nuevas: `empresas_dinamic_api_insert` y `empresas_dinamic_api_update`, ambas para `dinamic_api`.

Siguen `empresas_insert_admin` y `empresas_update_admin` para `authenticated`. Sin grant de INSERT ni UPDATE, esas políticas no dan escritura. El dueño de la tabla y un rol con `BYPASSRLS` no pasan por RLS; `dinamic_api` no es ninguno de los dos.

`anon` y `authenticated` no recibieron DML sobre `auth_compensation_jobs`, `client_operation_idempotency` ni `company_operation_idempotency`. Esas tablas quedaron con RLS y política para `dinamic_api`.

Este estado es el de la copia local. Test cloud conserva los grants anteriores hasta que se apruebe la ejecución.
