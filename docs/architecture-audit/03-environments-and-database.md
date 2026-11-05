# 03 — Entornos, bases y migraciones

## Inventario de proyectos Supabase

Fuente: herramienta de inventario de proyectos, 2026-11-05. No se imprimen claves ni connection strings.

| Proyecto | Ref | Región | Estado | Postgres | Creado | Papel verificado |
|----------|-----|--------|--------|----------|--------|------------------|
| `Dinamic-Clean-Test-DB` | `edruejzwwnixsjsadbgb` | us-west-2 | ACTIVE_HEALTHY | 17.6.1.166 | 2026-09-17 | Destino de `.env.local` y `apps/api/.env` en esta máquina |
| `dinamic-clean-personal` | `biectbcujabpjhinouil` | sa-east-1 | ACTIVE_HEALTHY | 17.6.1.147 | 2026-07-29 | Proyecto con datos operativos. El script de restore trata cualquier host `supabase.co` distinto del ref de test como riesgoso |
| `sgc-no-conformidades` | `wdjtztqmydrlbwmmwiep` | sa-east-1 | INACTIVE | 17.6.1.127 | 2026-06-08 | Otro producto. Sin referencias en este repo. Fuera del flujo Clean |

Edge Functions: lista vacía en los dos proyectos activos.

`supabase/config.toml` describe un stack local (`project_id = dinamic-clean-personal`, API `54321`, DB `54322`, Postgres major 17). Eso es la plantilla del CLI. No demuestra que alguien lo esté ejecutando como entorno compartido.

## A dónde apunta el desarrollo local

Verificado leyendo solo nombres, hosts y project refs. Valores secretos no se registran.

| Variable | Dónde está definida | Host / ref |
|----------|---------------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | `edruejzwwnixsjsadbgb` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | presente, no vacía |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | presente, no vacía. Ausente en `apps/api/.env` |
| `NEXT_PUBLIC_API_URL`, `API_URL` | `.env.local` y `apps/api/.env.local` | `http://127.0.0.1:3001` |
| `SUPABASE_URL` | `apps/api/.env` | mismo ref de test |
| `DATABASE_URL`, `MIGRATIONS_DATABASE_URL` | `apps/api/.env` | pooler `aws-0-us-west-2.pooler.supabase.com:5432` |
| `EXPECTED_SUPABASE_PROJECT_REF` | `apps/api/.env` | `edruejzwwnixsjsadbgb` |
| `DB_COMPATIBILITY_TARGET` | `apps/api/.env` | `test` |
| `CORS_ORIGIN` | `apps/api/.env` | localhost y `127.0.0.1` puerto 3000 |
| `SUPABASE_JWT_SECRET` | ninguno de los env locales | ausente. La API usa JWKS |

El ref de producción `biectbcujabpjhinouil` no aparece en esos archivos. Compose publica el API leyendo solo `apps/api/.env`. En ese archivo no está la service role. `index.ts` también carga `.env.local` de la raíz cuando el proceso corre desde el repo. Un contenedor que solo monta `apps/api/.env` no hereda esa clave. Con `NODE_ENV=production`, el proceso se niega a arrancar sin ella.

Auth, Storage y Postgres de cada proyecto son independientes. Compartir el proyecto de test entre locales y `cristian-pruebas` comparte usuarios de Auth, buckets, esquema y datos. No comparte nada con el proyecto de producción, siempre que las URLs no se crucen.

## Datos y esquema

`list_tables` del schema `public`. La columna de filas es la que devolvió el inventario. No se ejecutó `count(*)`. Puede ser estimada. Sirve para comparar órdenes de magnitud, no para auditoría contable.

El proyecto de producción reporta datos reales de operación: 265 empleados, 113 clientes, 167 domicilios, 458 artículos, 104 oportunidades CRM, 200 seguimientos, 13 perfiles. El proyecto de test reporta casi todas las tablas de negocio en 0, con residuos chicos (2 auditorías, 30 respuestas, 1 oportunidad, 1 proveedor, 0 perfiles).

Tablas presentes en producción y ausentes en el listado de test:

- `public.auth_compensation_jobs` — `supabase/migrations/forward/20261030160000_auth_compensation_jobs.sql`
- `public.client_operation_idempotency` — `20261030161000_create_idempotency.sql`
- `public.company_operation_idempotency` — `20261030171000_company_create_idempotency.sql`

Esas tres migraciones están en el árbol Git idéntico de `main`. El código actual puede escribirlas. El proyecto de test, según el inventario, todavía no las tiene. `readyz` no las comprueba: solo mira capacidades de fase 2D y 3A.

RLS figura habilitado en todas las tablas `public` listadas de ambos proyectos. El contenido de las policies no se auditó en esta pasada.

Storage en baseline, capturado el 2026-09-17 desde el proyecto de test (`supabase/baseline/003_storage.sql`): buckets privados `justificaciones` y `presupuestos-clientes`. La API firma URLs de corta vida con service role (`createSignedUrl` en `client-quotes-storage.ts`). El inventario en vivo de buckets no se consultó (`NOT_VERIFIED`).

No hay Edge Functions. No hay seeds de negocio versionados: `config.toml` apunta a `./seed.sql` y ese archivo no está en `supabase/`.

## Roles

`supabase/ops/create_api_role.sql` crea `dinamic_api` LOGIN, sin superuser, sin BYPASSRLS, con SELECT inicial. Los grants de escritura posteriores viven en migraciones forward. El rol efectivo de `DATABASE_URL` local no se consultó (`NOT_VERIFIED`). El ejemplo de entorno pide ese rol y reserva `MIGRATIONS_DATABASE_URL` para un rol administrativo que el proceso API no debe ver.

Guardas ya escritas, no ejecutadas en esta auditoría:

- `apps/api/scripts/check-db-compatibility.mjs` exige `RUN_DB_COMPATIBILITY_CHECK=1` y que `SUPABASE_URL` y `DATABASE_URL` coincidan con `EXPECTED_SUPABASE_PROJECT_REF`.
- `apps/api/tests/supabase-test-guard.ts` rechaza integración si el ref de test es igual al de producción.
- `scripts/restore-development.sh` trata como riesgoso todo `supabase.co` que no sea el ref de test, salvo `I_CONFIRM_DISPOSABLE=yes`.

## Alternativa de base para Cristian

**Alternativa A — un solo proyecto de test para locales y para `cristian-pruebas`.** Costo bajo. El proyecto ya existe y la máquina de desarrollo ya lo usa. El riesgo es alto: las suites `*.integration.test.ts` escriben cuando `RUN_SUPABASE_INTEGRATION=1`, el runner de migraciones apunta al mismo `MIGRATIONS_DATABASE_URL`, y un experimento de esquema deja al demo de la empresa inconsistente. Los residuos ya visibles (auditorías y CRM) muestran que el proyecto no es una base vacía de fábrica.

**Alternativa B — separar local de la validación compartida.** Recomendada.

- `cristian-pruebas` usa `Dinamic-Clean-Test-DB`, después de aplicar de forma controlada las migraciones forward que le faltan y de cargar perfiles de prueba. Deja de ser el destino de tests de escritura.
- Cada desarrollador usa `supabase start` (el `config.toml` ya está) o una base desechable.
- CI aplica migraciones sobre un stack Supabase CLI efímero. PostgreSQL puro no reproduce Auth, RLS, roles `anon`/`authenticated`/`service_role` ni Storage. El CLI local sí levanta esas piezas, con la salvedad de que no es el mismo build administrado de la nube.
- Producción sigue solo en `dinamic-clean-personal`. Ningún pipeline de pruebas recibe su URL, su service role ni su connection string.

Un tercer proyecto cloud de “staging” no hace falta para integrar `auditoria-nasser`. Esa rama no es un ambiente de demo. Sus checks corren en CI efímero. Un proyecto cloud extra se justifica solo si el CLI en GitHub Actions resulta inviable.

Antes de abrir el demo hay que confirmar usuarios de Auth y filas de `perfiles` en el proyecto de test. El inventario reportó 0 perfiles. Sin eso, el login del entorno compartido no tiene usuarios de negocio aunque la API levante.

## Migraciones

| Pieza | Comportamiento verificado |
|-------|---------------------------|
| Historia embebida | `supabase/baseline/001_public_schema.sql` absorbe el archivo histórico hasta `0033`. No se reaplican |
| Deltas | 28 SQL en `supabase/migrations/forward/`, orden léxico |
| Runner | `scripts/apply-forward-migrations.sh` |
| Libro | `app_migrations.forward_history` (filename + checksum). Lo crea el propio script |
| Libro de Supabase CLI | `list_migrations`: 2 filas en test (`phase3a_core_hr`, `phase3b_attendance`) y 0 en producción. No representa las forward |
| Rollback | `supabase/migrations/rollback/` existe y el runner lo excluye. No es rollback automático |
| Arranque de la API | no migra |

El script aplica cada archivo nuevo en una transacción junto con el insert del historial, y falla si el checksum de un archivo ya aplicado cambió. `--only` permite una migración suelta. El estado real de `forward_history` en cada proyecto no se leyó: la consulta SQL fue bloqueada en esta sesión. La ausencia de tres tablas en test es la evidencia indirecta de que producción recibió migraciones del 2026-10-30 que test no tiene. Qué otras diferencias de columnas existen queda `NOT_VERIFIED`.

### Procedimiento por entorno

1. **Local desechable.** `scripts/restore-development.sh` contra `RESTORE_TARGET_DB_URL` que no sea el proyecto compartido ni producción. Después, forward. Experimentos destructivos solo aquí.
2. **`cristian-pruebas`.** Migración controlada, no en cada push. Orden: backup del proyecto de test, `db:check-compatibility` con `DB_COMPATIBILITY_TARGET=test` y el ref `edruejzwwnixsjsadbgb`, aplicar forward con `MIGRATIONS_DATABASE_URL` de test, smoke de `/readyz` y de un login. Si la migración es incompatible, se detiene el deploy de la imagen nueva y se conserva la imagen anterior. No se ejecuta el SQL de `rollback/` de forma automática: varias migraciones agregan columnas y tablas; revertirlas borra datos de demo.
3. **CI de `auditoria-nasser`.** Base efímera. Aplicar baseline + forward desde cero. El job falla si el runner no termina. No toca test ni producción.
4. **Producción.** Fuera del pipeline de pruebas. Ventana con backup, precheck `DB_COMPATIBILITY_TARGET=production` y ref `biectbcujabpjhinouil`, aplicación forward, smoke, y plan de recuperación escrito antes del cambio. El código y la migración se promocionan juntos cuando la migración es compatible con la versión que sigue en producción (expand). El contrato (drop, rename, restricción nueva) entra en un release posterior.

Cambios destructivos requieren ticket propio, backup restaurable y compatibilidad de las dos versiones de aplicación que puedan convivir durante el deploy. El repositorio ya separa el rol de migración del rol de runtime. Hay que mantener esa separación en cada entorno, con secretos distintos.

## Impedir que pruebas lleguen a producción

La guardia tiene que estar en el proceso, no solo en la disciplina:

- El contenedor de `cristian-pruebas` rechaza el arranque si el ref de `SUPABASE_URL` o `DATABASE_URL` es `biectbcujabpjhinouil`.
- El environment de GitHub `cristian-pruebas` no contiene secretos cuyo nombre o project ref sea el de producción.
- `EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF` se compara en el job y el job falla si algún secreto de test lo contiene.
- Los tests de integración del pipeline usan la URL del servicio efímero que el propio job exporta, nunca un secret de nube compartido.
