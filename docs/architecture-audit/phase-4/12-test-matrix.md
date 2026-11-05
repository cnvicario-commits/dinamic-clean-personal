# 12 — Matriz de pruebas

`PASS_REAL` significa que el comando se ejecutó en esta sesión. Inspeccionar el YAML no alcanza. No hubo despliegue ni ejecución en GitHub.

## Comprobado

| Caso | Estado | Evidencia |
|---|---|---|
| Aislamiento estático de los cuatro workflows | `PASS_REAL` | `node scripts/ci/check-workflow-isolation.mjs` → `workflow_isolation_ok` |
| Nombres de migraciones, sin base | `PASS_REAL` | `migration_files 28 rollback_files 0` |
| Selección API, frontend, ambos y ninguno | `PASS_REAL` | `src/lib/phase4-cicd.test.ts`, 3 pruebas, exit 0 |
| `actionlint` de los cuatro workflows | `PASS_REAL` | exit 0, sin hallazgos |
| Sintaxis Compose de Cristian | `PASS_REAL` | `compose_config_ok` y `frontend_compose_config_ok` |
| Comando cerrado rechaza `docker system prune`, un SHA inválido y `production-apply` | `PASS_REAL` | exit 2 en `scripts/deploy/authorized-command.sh` |

## Cristian

| Caso | Estado |
|---|---|
| Push de frontend, backend, ambos o sin cambios relevantes | `NOT_VERIFIED` |
| Error de tests o de build dentro de GitHub | `NOT_VERIFIED` |
| Imagen ausente, healthcheck fallido y rollback | `NOT_VERIFIED` |
| Despliegues simultáneos sobre el VPS | `NOT_VERIFIED` |
| Rechazo de Supabase producción en el build del frontend | cubierto por los guardias ya existentes; este pipeline no se ejecutó |
| Producción no modificada durante un deploy de Cristian | `NOT_VERIFIED` |

## Producción

| Caso | Estado |
|---|---|
| PR válido o con tests fallidos en GitHub | `NOT_VERIFIED` |
| Release sin aprobación | el YAML falla cerrado si la variable no está; no se despachó |
| Release aprobado, deploy, Vercel, migración, healthcheck, rollback y orden | `NOT_VERIFIED` |
| Credenciales de Test en producción | el workflow de producción no las declara; GitHub no se observó |

No hay filas `FAIL` en lo que sí se ejecutó. Tampoco hay un escenario de despliegue marcado como validado.
