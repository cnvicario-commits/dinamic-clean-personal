# 05 — Validación de CI

Workflow: `.github/workflows/ci.yml`. Se dispara en push a `main`/`master` y en todo pull request. `permissions: contents: read`. Sin `environment`, sin secretos, sin SSH, sin service role y sin credenciales de migración cloud.

| Job | Qué hace | Ejecutado en GitHub |
|-----|----------|---------------------|
| `frontend` | `npm ci`, `tsc --noEmit`, lint, `npm test`, build, audit de npm, búsqueda básica de secretos | `NOT_VERIFIABLE`. `gh` no tiene sesión |
| `api` | `npm ci`, lint, typecheck, `npm test`, build, `npm audit --audit-level=critical` | `NOT_VERIFIABLE` en GitHub. Los mismos comandos pasaron en local |
| `api-integration` | Supabase CLI 2.117.0 y `./scripts/run-ephemeral-integration.sh` | `NOT_VERIFIABLE` en GitHub. El script local terminó exit 0 |

El job de integración no usa `continue-on-error` ni `if:` que lo saltee. Si Docker, el CLI o una migración fallan, el job falla. En local eso ya ocurrió: exit 3 al no poder comentar el schema `public`, y exit 1 cuando el `ALTER ROLE` era inválido. Esas corridas no cuentan como validación aprobada.

No hay workflow de deploy. Un push a `cristian-pruebas` sigue sin publicar nada.

## Límites

Los checks de este archivo todavía no son obligatorios en GitHub. Sin ruleset, un PR puede mergearse con el job en rojo. Eso queda registrado como `GITHUB_BRANCH_PROTECTION_DEFERRED`. La revisión humana del responsable técnico cubre ese hueco hasta que existan permisos de administración.

La búsqueda de secretos del job frontend es la que ya estaba: un `rg` de patrones de service role. No reemplaza un escáner de secretos del plan de GitHub.
