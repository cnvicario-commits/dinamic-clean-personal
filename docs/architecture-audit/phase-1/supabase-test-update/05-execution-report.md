# Ejecución sobre Supabase Test

Estado: no ejecutada.

Falta la aprobación explícita para escribir en `edruejzwwnixsjsadbgb`. No se corrió el runner contra ese proyecto. La consulta de lectura posterior al ensayo sigue mostrando 21 migraciones.

## Comando preparado

Tiene que ejecutarse sin `MIGRATIONS_DATABASE_URL` ni `DINAMIC_MIGRATION_TARGET` en el entorno, para que el script lea la clave de `apps/api/.env` y el guardia vuelva a exigir `test-cloud`:

```bash
env -u DINAMIC_MIGRATION_TARGET -u MIGRATIONS_DATABASE_URL ./scripts/apply-forward-migrations.sh
```

Resultado esperado: `forward_history 21 pending 7`, aplicación de los siete archivos, historial en 28, mismos checksums, conteos de negocio sin cambio.

Si un archivo falla: detenerse, no relanzar la secuencia completa y no hacer rollback automático. Las migraciones ya confirmadas quedan en `forward_history`.
