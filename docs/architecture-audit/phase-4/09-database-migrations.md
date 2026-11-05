# 09 — Migraciones

La validación, la aplicación y el despliegue de la aplicación son tres pasos distintos.

El CI ejecuta `scripts/ci/check-forward-migration-files.mjs`. Comprueba nombre, orden y versión única. No calcula un plan contra una base y no aplica SQL. Resultado local de esta sesión: `migration_files 28 rollback_files 0`.

La aplicación usa el runner existente. Ese runner registra `app_migrations.forward_history` con checksum SHA-256, exige que lo aplicado sea un prefijo del repositorio, no repite una migración con el mismo checksum y rechaza el ref productivo antes de conectar. No se modificó esa prohibición y no se agregó un bypass.

`.github/workflows/cd-migrations.yml` es manual. Pide la confirmación `migrate-test`, exige `CRISTIAN_MIGRATIONS_ENABLED=true` y solo entonces entra al environment `cristian-pruebas` para leer `CRISTIAN_MIGRATIONS_DATABASE_URL`. No está activado y no se ejecutó.

No hay workflow de migración productiva. El runner actual no puede apuntar a `biectbcujabpjhinouil`. Una migración productiva sigue siendo una operación separada, con respaldo y revisión, fuera de esta fase. Un rollback de contenedor no revierte el esquema. Una migración destructiva no entra en el workflow manual de Test: el runner aplica el siguiente archivo pendiente, así que un archivo destructivo tendría que excluirse del recorrido automático antes de activar la variable.

El despliegue de Cristian no llama al runner aunque el diff contenga SQL. El código y el esquema se publican por separado.
