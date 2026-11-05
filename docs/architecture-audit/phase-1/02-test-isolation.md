# 02 — Aislamiento de tests

## Regla

Un proceso con `NODE_ENV=test` solo puede construir un pool hacia `localhost`, `127.0.0.1` o `::1`. Cualquier otro host es `ambiguous` y se rechaza. Un host `*.supabase.co`, `*.supabase.com`, `*.supabase.in` o `*pooler.supabase*` es `cloud`. Si la cadena contiene `edruejzwwnixsjsadbgb` o `biectbcujabpjhinouil`, es `cloud` aunque el host parseado sea loopback.

`createDb` aplica esa regla antes de `new Pool` y usa el `NODE_ENV` del objeto de entorno, no el del shell. Con `NODE_ENV=development` el mismo helper no rechaza el proyecto de test. `npm run dev` no importa el setup de Vitest.

## Proceso de Vitest

`apps/api/tests/vitest-setup.ts` corre antes de las suites.

- Sin `RUN_SUPABASE_INTEGRATION=1`, borra variables de conexión cloud o ambiguas: `DATABASE_URL`, `MIGRATIONS_DATABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `PHASE4A_ADMIN_DATABASE_URL`, `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL`, `RESTORE_TARGET_DB_URL`.
- Con el flag, llama a `assertDinamicCleanTestTarget()` y aborta el worker si el destino no es simulación local.
- Sustituye `pg.Pool` para que un `new Pool` directo, fuera de `createDb`, pase por la misma regla antes de `super()`.

Las suites que antes cargaban `apps/api/.env` con dotenv (`crm-date`, `din402`, `ventas-role-smoke`) ya no lo hacen. El runner local entrega las variables.

## Pruebas de la protección

Archivo: `apps/api/tests/supabase-test-guard-environment.test.ts`. Cadenas ficticias o refs ya públicos en el repo. No se abrió un socket cloud: el rechazo ocurre antes de `new Pool`, y la corrida con URLs cloud exportadas terminó en el mismo tiempo que la suite unitaria.

| Caso | Resultado |
|------|-----------|
| URL con ref de producción | rechazo |
| URL con ref de Supabase Test, incluso en `127.0.0.1` | rechazo |
| Pooler `*.pooler.supabase.com` sin ref conocido | rechazo |
| Host no loopback y no Supabase | rechazo |
| `127.0.0.1`, `localhost`, `::1` | aceptación |
| Integración sin `DB_COMPATIBILITY_TARGET=simulation` | fallo explícito |
| Integración sin URL local | fallo explícito |
| `npm test` con URLs cloud en el entorno | las borra y la suite unitaria pasa |

## Suites revisadas

El setup cubre las que llaman `createDb`, las que hacen `new pg.Pool` y las que leen `process.env` al importar. Con el flag apagado, `results-postgres` y el resto de integraciones quedan en skip porque la URL cloud ya no está. `http.integration` además exige el flag antes de `buildApp`.
