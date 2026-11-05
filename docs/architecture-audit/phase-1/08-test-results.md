# 08 — Resultados de pruebas

Ningún resultado de esta lista se rellenó sin ejecutar el comando. Exit codes observados en esta sesión.

| Comando | Resultado | Detalle |
|---------|-----------|---------|
| `cd apps/api && npm test` | `PASS` exit 0 | 63 archivos pasados, 18 omitidos. 409 pruebas pasadas, 80 omitidas |
| El mismo `npm test` con `DATABASE_URL` de producción ficticia, `SUPABASE_URL` de test y un pooler cloud en el entorno | `PASS` exit 0 | 4,4 s. Mismos conteos. No hubo timeout de conexión |
| `cd apps/api && npm run typecheck` | `PASS` exit 0 | `tsc --noEmit` |
| `cd apps/api && npm run lint` | `PASS` exit 0 | eslint sin problemas |
| `cd apps/api && npm run build` | `PASS` exit 0 | `tsc` |
| `npm test` en la raíz | `PASS` exit 0 | 3 archivos, 13 pruebas |
| `npm run lint` en la raíz | `PASS` exit 0 | 2 warnings previos en `src/app/login/page.tsx` y `src/components/UsuarioEstadoBoton.tsx`. No se tocaron |
| `npx tsc --noEmit && npm run build` en la raíz | `PASS` exit 0 | Next.js 16.4.3, 44 páginas |
| `./scripts/run-ephemeral-integration.sh` | `PASS` exit 0 | host `127.0.0.1`, 17 pruebas de `http.integration.test.ts` |
| Primer intento del mismo script | `FAIL` exit 3 | `001_public_schema.sql`: `must be owner of schema public` |
| Segundo intento | `FAIL` exit 1 | `ALTER ROLE` con sintaxis inválida, después de aplicar los 28 forward en la base local |
| `docker info` | `PASS` | Docker disponible fuera del sandbox |
| `supabase --version` | `PASS` | `2.117.0` |
| Consulta de conteos en `edruejzwwnixsjsadbgb` | `PASS` | 21 / 15 / 15. Las siete migraciones ausentes. Sin escritura |
| Consulta de conteos en `biectbcujabpjhinouil` | `NOT_VERIFIABLE` | Bloqueada en esta sesión. No se reintentó |
| `./scripts/apply-forward-migrations.sh` contra Test | `BLOCKED` | No ejecutado |
| Jobs de GitHub Actions | `NOT_VERIFIABLE` | Sin `gh auth login` |
| `scripts/recon-vps-readonly.sh` | `NOT_ACCESSIBLE` | Sin SSH |

Las 80 pruebas de API omitidas son suites de integración que no ven `RUN_SUPABASE_INTEGRATION=1` durante `npm test`. Omitirlas ahí es el comportamiento pedido. El job de integración no las cuenta como aprobación: corre un archivo real y falla si el CLI falla.
