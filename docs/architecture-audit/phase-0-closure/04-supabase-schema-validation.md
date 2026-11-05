# 04 — Validación de esquema Supabase

Consultas de solo lectura del 2026-11-05. No se aplicó ninguna migración. No se listaron personas.

Proyectos: test `edruejzwwnixsjsadbgb`, producción `biectbcujabpjhinouil`.

## Corrección de la auditoría anterior

`list_tables` había informado 0 perfiles en test. Un `count(*)` da otro número. Esas filas del inventario anterior eran estimaciones. Los conteos de esta pasada son exactos y no identifican usuarios.

| | Test | Producción |
|--|------|------------|
| `auth.users` | 15 | 13 |
| `public.perfiles` | 15 | 13 |
| Filas en `app_migrations.forward_history` | 21 | 28 |
| Archivos forward en el repo | 28 | 28 |

Test no es un subconjunto vacío de producción. Tiene más usuarios de Auth que producción. No se copiaron identidades.

## Historial de migraciones

Los checksums SHA-256 guardados en ambos proyectos coinciden con el hash de los archivos actuales del repo, para cada filename presente. No hay drift de archivos ya aplicados.

Producción tiene los 28 archivos del repo, en el mismo orden de nombres, con el checksum del archivo actual.

Test tiene los primeros 21 y no tiene estos siete:

| Archivo | Efecto que hoy está solo en producción |
|---------|----------------------------------------|
| `20261008120000_production_schema_reconciliation.sql` | `crm_leads.updated_at` default `now()` y NOT NULL, FK `ON DELETE SET NULL`, revoca DML de `anon`/`authenticated` sobre leads. En test, `updated_at` ya es NOT NULL con default `now()` y la FK ya es `ON DELETE SET NULL`. El archivo es idempotente para esa forma |
| `20261030140000_empresas_api_write_grants.sql` | `dinamic_api` pasa a INSERT/UPDATE sobre `empresas` y se revocan escrituras de `anon` y `authenticated` |
| `20261030160000_auth_compensation_jobs.sql` | Crea `auth_compensation_jobs` |
| `20261030161000_create_idempotency.sql` | Crea `client_operation_idempotency` y amplía el check de compras |
| `20261030170000_auth_compensation_claim.sql` | Ajusta el check de estado del job de compensación |
| `20261030171000_company_create_idempotency.sql` | Crea `company_operation_idempotency` |
| `20261030172000_purchase_order_create_idempotency.sql` | Suma `purchase_order_create` al check |

El libro del CLI (`list_migrations` de la auditoría anterior) no es este historial. No se usa para decidir qué falta.

## Diferencias de esquema que el código actual necesita

`purchase_operation_idempotency` existe en los dos. El check no es el mismo.

- Test: `purchase_request_import`, `purchase_order_generate`.
- Producción: esos dos más `purchase_request_create` y `purchase_order_create`.

El código de `apps/api/src/infrastructure/db/purchases/purchase-orders.ts` y `purchase-requests.ts` inserta `purchase_order_create` y `purchase_request_create`. Contra el test actual, ese INSERT choca con el check.

`empresas`:

| Grantee | Test | Producción |
|---------|------|------------|
| `dinamic_api` | SELECT | INSERT, SELECT, UPDATE |
| `authenticated` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT |
| `anon` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | sin grants en el resultado |

RLS de `empresas` está habilitado en los dos. En test, `authenticated` todavía tiene las policies `empresas_insert_admin` y `empresas_update_admin`, y además el grant de escritura. En producción esas policies de `authenticated` siguen creadas, pero el grant de escritura ya no está: la escritura queda en `dinamic_api` (`empresas_dinamic_api_insert` y `empresas_dinamic_api_update`), que en test no existen.

`TRUNCATE` no lo frena RLS. PostgREST no publica `TRUNCATE`. El grant en test igual deja a `anon` y `authenticated` con un privilegio que producción ya sacó. Hay que aplicar `20261030140000` antes de usar esta base como demo.

Tablas ausentes en test, confirmadas con `to_regclass`: `auth_compensation_jobs`, `client_operation_idempotency`, `company_operation_idempotency`.

## Roles

Iguales en los dos proyectos:

| Rol | LOGIN | SUPER | BYPASSRLS | INHERIT |
|-----|-------|-------|-----------|---------|
| `dinamic_api` | sí | no | no | no |
| `anon` | no | no | no | sí |
| `authenticated` | no | no | no | sí |
| `authenticator` | sí | no | no | no |
| `service_role` | no | no | sí | sí |

`service_role` con BYPASSRLS es el comportamiento de Supabase. La API lo usa para Auth Admin y Storage, no como rol de las tablas de negocio. `dinamic_api` no lo bypassea.

Los grants de `dinamic_api` coinciden en el resto de las tablas comparadas. La diferencia de negocio es `empresas` y las tres tablas que test no tiene.

## Storage

Los dos proyectos tienen los mismos buckets, privados, sin `file_size_limit` cargado:

- `justificaciones`
- `presupuestos-clientes`

Coincide con `supabase/baseline/003_storage.sql`. No se listaron objetos.

## Auth

Hay usuarios y perfiles en test (15 y 15). El demo puede tener login si esas cuentas se conocen por un canal operativo. No se exportaron emails.

Site URL y redirect URLs de los proyectos cloud no están en Postgres. Siguen `NOT_ACCESSIBLE`. El `config.toml` solo fija el stack local en `http://127.0.0.1:3000`.

No hay Edge Functions (relevamiento anterior).

## Qué hay que hacer para que test corra el código actual

Sin ejecutarlo en esta fase:

1. Backup del proyecto test.
2. `./scripts/apply-forward-migrations.sh` con `MIGRATIONS_DATABASE_URL` de test, no de producción. El runner aplica solo los siete archivos que no están en `forward_history`.
3. Volver a leer el historial y el check de `purchase_operation_idempotency`. Tienen que quedar iguales a producción.
4. Confirmar que `anon` ya no tiene DML sobre `empresas`.
5. No restaurar un dump de producción encima. Test ya tiene sus propios 15 usuarios.

`20261008120000` es idempotente respecto de la forma actual de `crm_leads` en test. Igual entra en la misma corrida porque el runner no lo tiene registrado. No se ejecuta un rollback automático si un archivo posterior falla: los anteriores ya habrán hecho commit.
