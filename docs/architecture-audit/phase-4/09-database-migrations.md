# 09 — Migraciones

La validación, la aplicación y el despliegue siguen separados. El CD de Cristian no llama al runner.

`.github/workflows/cd-migrations.yml` solo acepta `workflow_dispatch` desde `refs/heads/main`, con la confirmación `migrate-test`, `CRISTIAN_MIGRATIONS_ENABLED=true` y el SHA del propio workflow. No hay un input para elegir otra rama. El job que tiene el secret exige que `scripts/assert-migration-target.mjs` clasifique el URL como `test-cloud`. Un URL con el ref productivo se rechaza antes de aplicar.

`scripts/ci/evaluate-migration-gate.mjs` marca como destructivo un `DROP TABLE`, `DROP SCHEMA`, `DROP COLUMN`, `TRUNCATE` o `DELETE FROM`. Un `REVOKE ... TRUNCATE` no entra en esa categoría. Los 28 archivos actuales no coinciden con el patrón destructivo. Si alguno coincidiera, el workflow se detiene.

El runner toma un lock de directorio en el equipo que lo ejecuta y el workflow usa el grupo de concurrencia `migrations-test`. Esa prueba de lock se ejecutó en local: la segunda invocación imprimió `MIGRATIONS_LOCKED`. No es un advisory lock de Postgres entre dos máquinas. Un proceso terminado con `SIGKILL` puede dejar el directorio; se retira a mano y no contiene datos. No se aplicó ninguna migración.

No existe un workflow que aplique migraciones productivas. El runner sigue sin aceptar `biectbcujabpjhinouil`.
