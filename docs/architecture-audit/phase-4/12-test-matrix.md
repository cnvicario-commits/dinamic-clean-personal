# 12 — Matriz de pruebas

Las filas `PASS_REAL` se ejecutaron en esta corrección. Los fixtures no tocan Docker ni una base.

| Caso | Estado | Evidencia |
|---|---|---|
| `/readyz` con `status=ready` | `PASS_REAL` | `assessHealthPayload` |
| `/readyz` con `status=ok` | `PASS_REAL` | razón `status` |
| HTTP 503 y timeout | `PASS_REAL` | fixture de `probeUrl` y del script de Cristian |
| Release distinto | `PASS_REAL` | razón `release` |
| Frontend sano con API no lista | `PASS_REAL` | el deploy de frontend no lee `/readyz` |
| Frontend A, fallo de C, vuelve A; API queda en B | `PASS_REAL` | fixture de `cristian-remote-apply.sh` |
| Imagen ausente antes de recrear | `PASS_REAL` | `current` permanece vacío |
| Digest distinto | `PASS_REAL` | `digestMatches` |
| Estado corrupto | `PASS_REAL` | el archivo no se reescribe |
| Dos escritores | `PASS_REAL` | `RELEASE_REJECTED locked` |
| Reintento del mismo run | `PASS_REAL` | `DEPLOY_CONFIRMED idempotent` |
| CI fallido, cancelado, SHA o rama incorrectos, fork | `PASS_REAL` | `evaluateCristianDeployGate` |
| Run de CI con otro SHA | `PASS_REAL` | `readSuccessfulCiRun` |
| Migración: rama, SHA, target, SQL destructivo y lock local | `PASS_REAL` | gate, scanner y `--lock-probe` |
| Ruta `/opt/dinamic-clean-cristian` | `PASS_REAL` | `allowed`; `/opt/dinamic-clean/certs` es `production` |
| Frontend `npm test` | `PASS_REAL` | 35 pruebas, exit 0 |
| Frontend lint y build | `PASS_REAL` | lint exit 0 con dos warnings previos; build exit 0 |
| API test, lint, typecheck y build | `PASS_REAL` | 438 passed, 80 skipped; los tres comandos exit 0 |
| `actionlint` y `shellcheck` | `PASS_REAL` | exit 0 |
| Compose de frontend | `PASS_REAL` | `frontend_compose_config_ok` |

| Caso no ejecutado | Estado |
|---|---|
| Corrida de GitHub, GHCR, SSH y contenedores del VPS | `NOT_VERIFIED` |
| Lock de migraciones entre dos máquinas | `NOT_VERIFIED` |
| Compose productivo leído del VPS | `NOT_VERIFIED` |
| Vercel | `VERCEL_INTEGRATION_NOT_VERIFIED` |

No hay filas `FAIL` en lo ejecutado. El fixture de deploy no es un despliegue real.
