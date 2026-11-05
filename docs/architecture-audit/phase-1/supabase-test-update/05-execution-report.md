# Ejecución sobre Supabase Test

Aprobación explícita recibida para las siete migraciones sobre `edruejzwwnixsjsadbgb`.

## Preflight repetido, antes de escribir

- Identidad de `apps/api/.env`: `test-cloud`, pooler, rol `postgres`, puerto `5432`.
- Historial: 21 filas, prefijo exacto del repositorio, checksums sin deriva.
- Pendientes, en orden: los siete archivos previstos. Las tres tablas nuevas seguían ausentes.
- Conteos: Auth 15, perfiles 15, empresas 3, clientes 113, empleados 265, pedidos 10, órdenes 5, leads 0, idempotencia de compras 0, buckets 2, objetos 5.
- Backup presente, no vacío, modos `700` y `600`, en `~/.dinamic-clean-backups/test-edruejzwwnixsjsadbgb-20261105T131748Z`. Sigue siendo un dump SQL: no incluye bytes de Storage ni la configuración de Auth del dashboard.

## Comando

```bash
env -u DINAMIC_MIGRATION_TARGET -u MIGRATIONS_DATABASE_URL ./scripts/apply-forward-migrations.sh
```

El guardia imprimió `MIGRATION_TARGET test-cloud` antes de conectar. Luego: `forward_history 21 pending 7`. Las 21 anteriores quedaron como ya aplicadas. Se aplicaron las siete. Exit 0. Duración 83 s.

Avisos de `IF EXISTS` sobre un trigger y políticas que Test no tenía. No hubo error de constraint. No se ejecutó rollback.

Producción no se usó.
