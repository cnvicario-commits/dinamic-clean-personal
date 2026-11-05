# 01 — Resumen ejecutivo

Fecha de relevamiento: 2026-11-05. Alcance: repositorio `dinamic-clean-personal`, proyectos Supabase visibles para la cuenta conectada, y configuración local de nombres de variables. No se modificó infraestructura, no se aplicaron migraciones y no se ejecutaron suites de test.

Estado de la auditoría: **PARTIAL**. El código, la composición de ramas, los dos proyectos Supabase activos y el CI del repositorio están verificados. El VPS, Nginx, TLS, Vercel, la protección de ramas en GitHub y el historial `app_migrations.forward_history` no fueron accesibles.

## Estado actual

- El sistema es un monolito Next.js 16 (`src/`) más una API Fastify en `apps/api`, ambos contra Supabase PostgreSQL 17. La autenticación de usuarios sigue en Supabase Auth. La API verifica el JWT y autoriza con RBAC propio. Varias lecturas del navegador siguen yendo directo a PostgREST.
- Existen dos proyectos activos y separados: `Dinamic-Clean-Test-DB` (`edruejzwwnixsjsadbgb`, `us-west-2`) y `dinamic-clean-personal` (`biectbcujabpjhinouil`, `sa-east-1`). La configuración local de esta máquina apunta solo al primero. El segundo concentra los datos operativos (empleados, clientes, CRM, artículos).
- `origin/main`, `origin/auditoria-nasser` y `origin/cristian-pruebas` tienen el mismo árbol Git (`dc158fccd60f44e91784f020ade52a219d1e96d2`). El historial de `cristian-pruebas` ya contiene commits duplicados y merges de realineación que no cambian archivos.
- El único workflow es `.github/workflows/ci.yml`. Corre en push a `main`/`master` y en todo pull request. Un push a `cristian-pruebas` no dispara CI ni despliegue. No hay `vercel.json`, Nginx, registro de imágenes ni workflow de deploy en el repositorio.
- La API tiene Dockerfile multi-stage y un Compose de un solo servicio (`deploy/docker-compose.api.yml`) pensado para un puerto `3001` y la imagen `dinamic-clean-api:local`. No hay segunda pila definida.

## Problemas que condicionan el acuerdo de trabajo

1. Reutilizar la base de pruebas para el entorno compartido de Cristian y, al mismo tiempo, para tests de integración con escritura, mezcla datos de demo, migraciones experimentales y suites destructivas. El proyecto de test además no tiene tres tablas que producción sí tiene y que el código actual crea por migración.
2. Derivar tickets desde `cristian-pruebas` mezcla trabajo incompleto. El historial actual ya muestra ese costo: la rama tiene 13 commits que `main` no tiene y el diff de archivos es vacío.
3. No hay quality gate que ejecute PostgreSQL real. CI corre los tests de la API con las suites de integración salteadas (`RUN_SUPABASE_INTEGRATION` no está definido). El frontend ni siquiera ejecuta `npm test`.
4. Un workflow modificable en `cristian-pruebas` no debe recibir secretos de producción. Hoy no hay environments de GitHub en el repo; la protección de `main` no pudo verificarse porque `gh` no está autenticado.
5. El backend de producción no está descrito como pipeline. El runbook citado en `apps/api/README.md` (`docs/phase-1-deploy-runbook.md`) no está en el repositorio. El estado real del VPS queda pendiente de un relevamiento de solo lectura.

## Recomendación en una frase

Mantener a Cristian iterando en `cristian-pruebas` como rama de demostración, desplegarla con credenciales exclusivas del proyecto de test, y promover cada ticket desde una rama nacida en `main`, con PR hacia `auditoria-nasser` y después hacia `main`. No promover `cristian-pruebas` completa.

## Decisiones que este informe recomienda

| Decisión | Recomendación |
|----------|----------------|
| Frontend de pruebas | Proyecto Vercel separado, dominio propio, variables de test |
| Backend de pruebas | Segundo Compose en el VPS actual, con guardia de project ref, límites y vhost propio. VPS separado solo si el relevamiento muestra recursos o red compartidos de forma insegura |
| Base compartida | El proyecto de test pasa a ser solo el entorno de Cristian. Local y CI dejan de escribir ahí |
| CI de `cristian-pruebas` | GitHub-hosted runner, registry, SSH con usuario limitado al stack de pruebas. Sin secretos de producción |
| Gate de `auditoria-nasser` | Lint, typecheck, build, tests unitarios y migración + integración sobre Supabase CLI efímero |
| `main` | Mismo SHA ya validado, environment `production` con aprobación, migraciones manuales y smoke posterior |
