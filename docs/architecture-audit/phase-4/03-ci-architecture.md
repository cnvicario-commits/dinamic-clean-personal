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

El CD de Cristian no escucha el push. Espera a que este workflow termine y después valida el SHA, la rama, el evento y el repositorio. Las acciones quedan fijadas al commit leído el 2026-11-05: `actions/checkout` `11d5960a326750d5838078e36cf38b85af677262`, `actions/setup-node` `49933ea5288caeca8642d1e84afbd3f7d6820020` y `supabase/setup-cli` `1dedf2c611547ede7232d26866dd3c56ab903bbb`.

El workflow no fue ejecutado por GitHub en esta sesión. `actionlint` terminó sin hallazgos. Los checks locales están en `src/lib/phase4-cicd.test.ts`.
