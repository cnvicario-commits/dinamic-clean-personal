# 10 — Bloqueos y evidencia

Estado: `PHASE_0_PARTIALLY_VERIFIED`.

No está `PHASE_0_CLOSED` porque el VPS, Vercel y GitHub no se verificaron. Escribir estos archivos no sustituye esa lectura.

## Evidencia nueva

| Hecho | Fuente |
|-------|--------|
| Test: 21 migraciones, 15 `auth.users`, 15 `perfiles`. Sin las tres tablas de idempotencia/compensación | `execute_sql` de conteo y `to_regclass` sobre `edruejzwwnixsjsadbgb` |
| Producción: 28 migraciones, 13 usuarios, 13 perfiles. Las tres tablas existen | La misma consulta sobre `biectbcujabpjhinouil` |
| Los 28 checksums de producción y los 21 de test coinciden con SHA-256 de `supabase/migrations/forward/` | `forward_history.checksum` comparado con hash local |
| Check de compras en test sin `purchase_request_create` ni `purchase_order_create`. En producción están | `pg_get_constraintdef` |
| Esos dos valores los inserta el código actual | `purchase-orders.ts`, `purchase-requests.ts` |
| `empresas` en test: `anon` y `authenticated` con DML incluyendo TRUNCATE. En producción, `authenticated` solo SELECT y `dinamic_api` INSERT/UPDATE | `information_schema.role_table_grants` |
| `crm_leads.updated_at` NOT NULL con default `now()` y FK `ON DELETE SET NULL` en los dos | `information_schema.columns` y `pg_constraint` |
| Roles `dinamic_api` sin BYPASSRLS en los dos. `service_role` con BYPASSRLS y sin LOGIN | `pg_roles` |
| Buckets privados `justificaciones` y `presupuestos-clientes` en los dos, sin límite cargado | `storage.buckets` |
| Policies de insert/update de `dinamic_api` sobre `empresas` solo en producción | `pg_policies` |
| CLI de Supabase presente en `/opt/homebrew/bin/supabase`. Versión no impresa | `command -v`. `--version` falló al escribir telemetría |
| `gh` sin login. Sin `.vercel/project.json`. Sin `vercel` en PATH. Sin SSH config | comandos de esta sesión |
| Árbol Git único de las tres ramas | relevamiento anterior, no rehecho porque no hubo fetch nuevo que lo contradiga |

## Bloqueos

1. Correr en el VPS el script de `01-vps-verification.md` y devolver la salida ya sanitizada.
2. Leer en Vercel el proyecto, la Production Branch, los dominios y los nombres de variables. Anotar solo el ref dentro de `NEXT_PUBLIC_SUPABASE_URL`.
3. `gh auth login` y las lecturas de protection, rulesets, environments y colaboradores de `03-github-security.md`. Confirmar si el plan soporta un workflow exigido por ruleset.
4. Anotar Site URL y Redirect URLs de los dos proyectos Supabase, sin copiar claves.
5. `supabase --version` en una máquina donde el CLI pueda escribir su telemetría, o con telemetría desactivada.

## Lo que ya permite preparar la fase 1

La fase 1 no despliega. Su criterio de aceptación está en `08-updated-roadmap.md`: poner test a la par del código y cerrar el camino de `npm test` hacia las dos bases cloud. Eso puede empezar cuando haya backup del proyecto test. No puede empezar el segundo contenedor ni el proyecto Vercel.

## Riesgo crítico que sí está demostrado

El código de `main` no puede crear pedidos ni órdenes de compra con idempotencia contra el proyecto de test: el check lo rechaza. Además, en test el rol `authenticated` conserva escritura sobre `empresas`, que producción ya le quitó. Usar esa base como demo del código actual, sin los siete archivos que faltan, deja operaciones rotas y un grant de más. No es un acceso cruzado a producción. El env local y los grants de producción siguen en proyectos distintos.
