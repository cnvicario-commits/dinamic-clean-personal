# 02 — Validación del workflow

Archivo: `.github/workflows/ci.yml`.

`actionlint .github/workflows/ci.yml` terminó con exit 0 y sin diagnósticos. El archivo no solo parsea como YAML: actionlint aplica el esquema de GitHub Actions.

| Job | Directorio de trabajo | Dependencias |
|-----|----------------------|--------------|
| `frontend` | raíz del repo, el default | `npm ci`, `tsc --noEmit`, lint, `npm test`, build, audit y el `rg` de secretos |
| `api` | `apps/api`, vía `defaults.run.working-directory` | `npm ci` usa `apps/api/package-lock.json` (`cache-dependency-path` del action, que no depende del working directory) |
| `api-integration` | raíz | `npm ci --prefix apps/api`, Supabase CLI 2.117.0, `./scripts/run-ephemeral-integration.sh` |

`permissions: contents: read` queda en el workflow. No hay `environment` ni secretos.

La corrida en `ubuntu-latest` de GitHub no se vio: `gh` sigue sin sesión. La validación de esquema es local. El script que ejecutaría el job de integración sí corrió en esta máquina, exit 0.
