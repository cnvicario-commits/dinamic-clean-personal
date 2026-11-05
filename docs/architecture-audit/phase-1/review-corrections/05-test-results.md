# 05 — Resultados

| Comando | Resultado |
|---------|-----------|
| `cd apps/api && npx vitest run tests/disposable-restore-target.test.ts` | PASS, 10 pruebas |
| `cd apps/api && npm test` | PASS, 419 pasadas, 80 omitidas, 64 archivos pasados, 18 omitidos |
| `cd apps/api && npm run lint` | PASS |
| `cd apps/api && npm run typecheck` | PASS |
| `cd apps/api && npm run build` | PASS |
| `npm test` en la raíz | PASS, 13 pruebas |
| `npm run lint` en la raíz | PASS, 2 warnings previos en login y `UsuarioEstadoBoton` |
| `npx tsc --noEmit && npm run build` | PASS, Next.js 16.4.3 |
| `I_CONFIRM_DISPOSABLE=yes ./scripts/restore-development.sh` con URL de producción | FAIL cerrado, exit 1, `RESTORE_TARGET_REJECTED cloud`. No conectó |
| `actionlint .github/workflows/ci.yml` | PASS, exit 0, sin hallazgos |
| `bash -n` de restore y del script efímero | PASS |
| `./scripts/run-ephemeral-integration.sh` con `results-postgres` incluido | FAIL, exit 1. Una prueba esperaba 502 y recibió 409. La suite se retiró del job |
| `./scripts/run-ephemeral-integration.sh` sin esa suite | PASS, exit 0, host `127.0.0.1`, 20 pruebas en 3 archivos |
| Migraciones cloud | BLOCKED, no ejecutadas |
| `git diff --check` | ver el artefacto de review de esta corrección |

La rama `LOCAL_SUPABASE_ALREADY_RUNNING` no se ejercitó: al empezar, el CLI no estaba levantado.
