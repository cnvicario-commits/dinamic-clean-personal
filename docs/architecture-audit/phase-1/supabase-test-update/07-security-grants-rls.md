# Grants y RLS después de la migración

Lectura en `edruejzwwnixsjsadbgb`.

## `empresas`

Privilegios efectivos:

| Rol | SELECT | INSERT | UPDATE | DELETE | TRUNCATE |
| --- | --- | --- | --- | --- | --- |
| `dinamic_api` | sí | sí | sí | no | no |
| `authenticated` | sí | no | no | no | no |
| `anon` | no | no | no | no | no |

RLS activo. Políticas de `dinamic_api`: select, insert y update. `authenticated` conserva `empresas_select_all_logged`, `empresas_insert_admin` y `empresas_update_admin`. Esas dos últimas no otorgan escritura: el rol ya no tiene INSERT ni UPDATE.

`postgres` y `service_role` conservan los privilegios de plataforma, incluido `TRUNCATE`. No son el rol de la API ni los roles del browser. `dinamic_api` no es superusuario y no tiene `BYPASSRLS`.

## Tablas nuevas

RLS activo. Cada una tiene una política `FOR ALL` limitada a `dinamic_api`. `anon` y `authenticated` no aparecen en `role_table_grants`. `postgres` y `service_role` tienen los privilegios de plataforma.
