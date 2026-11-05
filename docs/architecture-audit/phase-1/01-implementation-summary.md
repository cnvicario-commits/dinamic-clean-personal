# 01 — Resumen de implementación

Estado de la fase: `PHASE_1_PARTIAL`.

## Hecho

- El proceso de `npm test` deja de heredar destinos cloud. Con `DATABASE_URL`, `SUPABASE_URL` y `MIGRATIONS_DATABASE_URL` apuntando a hosts alojados, la suite de la API terminó en 4,4 s, 409 pruebas pasadas y 80 omitidas, sin abrir esas conexiones.
- La integración explícita exige `RUN_SUPABASE_INTEGRATION=1`, `NODE_ENV=test`, `DB_COMPATIBILITY_TARGET=simulation` y hosts de loopback. `scripts/run-ephemeral-integration.sh` levanta Supabase CLI, aplica baseline y forward, corre `tests/http.integration.test.ts` y apaga el stack. Resultado ejecutado: exit 0, 17 pruebas pasadas, host `127.0.0.1`.
- El workflow de CI agrega tests de frontend y un job `api-integration` sin secretos. `permissions: contents: read`. No hay workflow de deploy.
- `npm run dev` no carga el guard de Vitest. `createDb` solo rechaza destinos no locales cuando `NODE_ENV` es `test`.

## No hecho

- No se aplicaron las siete migraciones pendientes en Supabase Test. No hay backup restaurable demostrado ni aprobación explícita. Subfase 1C: `BLOCKED`.
- No se creó el segundo backend ni un proyecto Vercel.
- No hubo push, merge ni deploy.
- VPS, Vercel y la configuración viva de GitHub siguen sin acceso. La protección de ramas queda `GITHUB_BRANCH_PROTECTION_DEFERRED`.

## Decisión preservada

Desarrollo local y la demo de `cristian-pruebas` siguen compartiendo Supabase Test `edruejzwwnixsjsadbgb`. El aislamiento aplica al runner de tests, no al servidor de desarrollo. Producción sigue siendo `biectbcujabpjhinouil` y no se modificó desde este trabajo.
