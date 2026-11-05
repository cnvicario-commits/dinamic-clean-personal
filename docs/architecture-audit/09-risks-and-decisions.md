# 09 — Riesgos y decisiones

## Hallazgos

| ID | Hallazgo | Prioridad | Clase | Evidencia |
|----|----------|-----------|-------|-----------|
| H1 | El proyecto de test no lista `auth_compensation_jobs`, `client_operation_idempotency` ni `company_operation_idempotency`, que producción sí lista y que el código de `main` crea | P1 | PARTIALLY_VERIFIED | `list_tables` 2026-11-05 y los tres SQL del 2026-10-30 |
| H2 | Producción concentra datos operativos. Test está casi vacío y con 0 perfiles reportados | P1 | PARTIALLY_VERIFIED | `list_tables` filas. Sin `count(*)` |
| H3 | Local, migraciones y tests de integración pueden usar el mismo proyecto de test | P1 | VERIFIED | `apps/api/.env` ref `edruejzwwnixsjsadbgb`; suites con `RUN_SUPABASE_INTEGRATION` |
| H4 | Push a `cristian-pruebas` no corre CI ni deploy | P1 | VERIFIED | `.github/workflows/ci.yml` `on.push.branches` |
| H5 | CI deja verdes las suites de integración porque no define el flag | P1 | VERIFIED | `describe.skipIf` y el workflow |
| H6 | No hay pipeline de producción en el repo. El runbook citado no existe | P1 | NOT_ACCESSIBLE el VPS. VERIFIED la ausencia del archivo | `apps/api/README.md` apunta a `docs/phase-1-deploy-runbook.md` |
| H7 | `cristian-pruebas` tiene 13 commits propios y diff vacío contra `main`, con rebase y merges duplicados | P1 | VERIFIED | `git rev-list`, `git diff`, árboles iguales |
| H8 | Protección de ramas no consultable | P1 | NOT_ACCESSIBLE | `gh auth status` sin login |
| H9 | Vercel, Nginx, TLS y el proceso real de producción no están en el repo | P1 | NOT_ACCESSIBLE | sin `vercel.json`, sin nginx |
| H10 | Lecturas PostgREST siguen en dashboard, empresas, layout y proxy. La UI no es la autorización | P2 | VERIFIED | `src/app/dashboard/page.tsx`, `src/app/empresas/page.tsx`, `src/proxy.ts` |
| H11 | `createAdminClient` con service role no se usa, y sigue en el árbol de Next | P2 | VERIFIED | `src/utils/supabase/admin.ts` sin importadores |
| H12 | Service role está en `.env.local` de la raíz y no en `apps/api/.env`. El contenedor que solo carga ese env no la tiene | P2 | VERIFIED | nombres de variables. Compose `env_file` |
| H13 | `/healthz` no identifica el SHA. No hay métricas ni alertas versionadas | P2 | VERIFIED | `health.ts` |
| H14 | Compose sin límites de CPU/memoria y con un solo puerto 3001 | P2 | VERIFIED | `deploy/docker-compose.api.yml` |
| H15 | Varias suites de integración no llaman a `assertDinamicCleanTestTarget` | P2 | VERIFIED | `http.integration.test.ts`, `purchases-postgres.integration.test.ts` y afines |
| H16 | `restore-development.sh` acepta un host riesgoso si `I_CONFIRM_DISPOSABLE=yes` | P2 | VERIFIED | el script |
| H17 | Tres tests de frontend y ninguno en CI | P2 | VERIFIED | `vitest.config.ts`, `ci.yml` |
| H18 | Sin cobertura medida. Un porcentaje de gate sería arbitrario | P3 | VERIFIED | scripts de `package.json` |
| H19 | Sin E2E | P3 | VERIFIED | dependencias |
| H20 | `sgc-no-conformidades` inactivo, sin uso en este repo | P3 | VERIFIED | inventario de proyectos |
| H21 | RLS aparece habilitado en las tablas listadas. Las policies no se releyeron | P2 | PARTIALLY_VERIFIED | `list_tables` `rls_enabled: true` |
| H22 | Libro `forward_history` no leído. `list_migrations` del CLI no es ese libro | P1 | NOT_VERIFIED el libro. VERIFIED el desfase del CLI | test: 2 filas CLI; producción: 0 |

No hay un P0 confirmado de “el demo ya apunta a producción”: los env locales apuntan al ref de test y el ref de producción no está en esos archivos. El P0 aparecería si el relevamiento del VPS muestra un solo `.env` o un Nginx que envía el dominio de pruebas al contenedor de producción. Eso hoy es desconocido, no es un defecto cerrado.

## Decisiones

| ID | Decisión | Estado | Recomendación |
|----|----------|--------|---------------|
| D1 | Dónde corre el segundo API | Pendiente de la fase 0 | Mismo VPS con aislamiento de usuario, puerto, vhost y ref. Otro VPS si el relevamiento muestra red o secretos compartidos |
| D2 | Qué base usa el demo | Recomendada, no aplicada | El proyecto de test, solo para el demo, después de igualar migraciones y de sacar los tests de escritura |
| D3 | Proyecto Vercel | Recomendada | Proyecto nuevo para `cristian-pruebas`. El proyecto de producción no observa esa rama como Production |
| D4 | Base del ticket | Recomendada | `main`, con cherry-pick si el trabajo ya está solo en la demo |
| D5 | Integración de CI | Recomendada | Supabase CLI efímero. Tercer proyecto cloud solo si el CLI no corre en Actions |
| D6 | Migraciones automáticas en el push | Recomendada | No. Job aparte con backup |
| D7 | Umbral de cobertura | Pendiente del primer informe | Publicar el número. No bloquear con un porcentaje inventado |
| D8 | Limpiar historia de `cristian-pruebas` con rebase | Rechazada | El rebase anterior duplicó commits. De aquí en más, merge de `main` |

## Preguntas que siguen abiertas

1. ¿Quién administra el VPS y hay un segundo dominio DNS disponible?
2. ¿El frontend de producción está en Vercel y cuál es el dominio?
3. ¿`main` tiene branch protection hoy?
4. ¿`forward_history` de producción y de test coinciden salvo las tres tablas vistas?
5. ¿Hay usuarios de Auth en el proyecto de test, dado que `perfiles` reporta 0 filas?
6. ¿El backup de producción existe y se probó un restore?
7. ¿Cristian tiene permiso de admin en el repo o solo push a su rama?
