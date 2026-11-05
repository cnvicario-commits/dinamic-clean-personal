# Backup y restauración de ensayo

Fecha UTC del dump: `20261105T131748Z`.

Directorio, fuera del repositorio, modo `700`; archivos modo `600`:

`~/.dinamic-clean-backups/test-edruejzwwnixsjsadbgb-20261105T131748Z`

El script `scripts/backup-supabase-test.sh` aborta salvo que `assert-migration-target.mjs` imprima `MIGRATION_TARGET test-cloud`. La corrida imprimió pooler, rol `postgres`, puerto `5432`.

## Alcance

Esto es un dump SQL. No es una copia del proyecto Supabase.

| Artefacto | Bytes | Contenido |
| --- | ---: | --- |
| `public-and-history.dump` | 380727 | `public` y `app_migrations`, formato custom |
| `auth-users.dump` | 3808 | solo datos de `auth.users`; 15 filas |
| `storage-metadata.dump` | 2952 | solo datos; 2 buckets y 5 filas de `storage.objects` |

No incluye los bytes de Storage ni la configuración de Auth del dashboard (proveedores, SMTP, plantillas, redirects).

## Restauración

Destino: Postgres 17 desechable en `127.0.0.1:55432`, contenedor `dinamic-restore-drill`. No es producción ni el proyecto Test. El contenedor se eliminó después de las comprobaciones. El dump se conserva.

Antes de restaurar se crearon `pg_trgm`, `pgcrypto`, los roles `anon`, `authenticated`, `service_role`, `dinamic_api` y `supabase_admin`, y un `auth.users(id)` mínimo con `auth.uid()`.

`pg_restore --no-owner` del dump de `public` terminó con errores ignorados. En el segundo pase quedaron 10: esquemas ya existentes, copia duplicada de `forward_history` (la clave primaria dejó 21 filas), un índice que pide `public.gin_trgm_ops` porque `DROP SCHEMA public` se había llevado la extensión, y tres claves foráneas hacia `auth.users` vacío (`perfiles` y dos tablas de idempotencia).

Después se insertaron en el stub solo los 15 `id` de `auth.users`, sin el resto de columnas. Conteos leídos en la copia, antes de migrar:

| Tabla | Copia | Test cloud |
| --- | ---: | ---: |
| `forward_history` | 21 | 21 |
| `auth.users` (solo ids) | 15 | 15 |
| `perfiles` | 15 | 15 |
| `empresas` | 3 | 3 |
| `clientes` | 113 | 113 |
| `empleados` | 265 | 265 |
| `pedidos_compra` | 10 | 10 |
| `ordenes_compra` | 5 | 5 |

La copia no reproduce el esquema completo de GoTrue ni los archivos de Storage. Sí reproduce el esquema `public`, el historial de 21 migraciones y los conteos de negocio usados para el ensayo.
