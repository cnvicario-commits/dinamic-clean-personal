# 03 — Integración continua

Archivo: `.github/workflows/ci.yml`.

Se ejecuta en pull request y en push a `main`, `master` y `cristian-pruebas`. Permiso único: `contents: read`. No declara `environment`, no lee secretos y no abre SSH.

| Job | Trabajo | Paralelismo |
|---|---|---|
| `frontend` | `npm ci`, `tsc --noEmit`, lint, test, build, auditoría npm y búsqueda básica de material de service role | paralelo |
| `api` | `npm ci`, lint, typecheck, test, build y `npm audit --audit-level=critical` | paralelo |
| `api-integration` | Supabase CLI efímero local mediante `scripts/run-ephemeral-integration.sh` | paralelo |
| `deploy-guards` | aislamiento de workflows, nombres de migraciones y sintaxis de los Compose de Cristian | paralelo |

`actions/setup-node` reutiliza la caché de npm. El job de guardias no compila la aplicación. La sintaxis de Compose imprime `docker_compose_config_is_not_a_deploy_preflight`: no reemplaza el preflight real.

`scripts/ci/check-forward-migration-files.mjs` ordena los 28 archivos, rechaza versiones duplicadas y no se conecta. `scripts/ci/check-workflow-isolation.mjs` rechaza un workflow de Cristian con environment de producción, un despliegue productivo disparado por rama y el uso de `latest`.

Ningún job llama a `scripts/apply-forward-migrations.sh`.

El workflow nuevo no fue ejecutado por GitHub en esta sesión. `actionlint` terminó sin hallazgos sobre los cuatro workflows. Los checks de guardias y el test `src/lib/phase4-cicd.test.ts` se ejecutaron en local.
