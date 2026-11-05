# 03 — Supabase CLI efímero

## Entorno comprobado

| Pieza | Resultado |
|-------|-----------|
| Supabase CLI | `2.117.0` en `/opt/homebrew/bin/supabase`. El CI fija la misma versión. |
| Docker | `docker info` exit 0 fuera del sandbox |
| Postgres del CLI | 17, puerto local `127.0.0.1:54322` |
| API local | `http://127.0.0.1:54321` |
| `supabase/config.toml` | `[db.seed] enabled = false`. No hay `supabase/seed.sql`; con seed activo `supabase start` falla |
| Baseline | `001_public_schema.sql`, `002_grants.sql`, `003_storage.sql` |
| Forward | 28 archivos, aplicados por `scripts/restore-development.sh` |

## Secuencia

`scripts/run-ephemeral-integration.sh`:

1. Falla con `DOCKER_UNAVAILABLE` si Docker no responde. Exit 1.
2. `supabase start`. La salida queda en un archivo temporal y se descarta. Si el arranque falla, el job imprime un extracto sin JWT ni claves y termina distinto de cero.
3. Exige que el host de `DB_URL` sea loopback.
4. En esa base local, recrea `public` y restaura como `supabase_admin`.
5. Crea `dinamic_api` si no existe y le asigna una contraseña aleatoria solo en memoria, para esta corrida.
6. Ejecuta `tests/http.integration.test.ts` con `USE_LOCAL_SUPABASE=1`.
7. `supabase stop --no-backup` al salir, también si el paso anterior falló.

No hay fallback a Supabase Test. `run-integration-with-env.mjs` sale 2 si falta `USE_LOCAL_SUPABASE=1` o si `supabase status` no devuelve URLs de loopback. No lee `apps/api/.env`.

## Ejecución

Comando: `./scripts/run-ephemeral-integration.sh`.

Resultado final: `PASS`, exit 0, 62 s en la corrida exitosa. Vitest: `Test Files 1 passed`, `Tests 17 passed`. Incluye `GET /healthz` 200, `GET /readyz` 200 y `GET /v1/me` 401 contra la base local. El rol de la app en esa corrida es `dinamic_api`, sin `BYPASSRLS`; si no lo fuera, `/readyz` responde 503 y la suite falla.

Corridas anteriores del mismo comando, antes del ajuste, fallaron de verdad: exit 3 por `must be owner of schema public` en el baseline, y exit 1 por el `ALTER ROLE` mal formado. No se marcaron como éxito.

## Diferencias con los proyectos cloud

- `postgres` en el CLI no es superusuario. `public` pertenece a `pg_database_owner`. El restore local usa `supabase_admin`.
- El índice `articulos_proveedor_nombre_trgm_idx` exige `public.gin_trgm_ops`. En el CLI, `pg_trgm` puede estar en el schema `extensions`. El restore lo crea o lo mueve a `public` antes del baseline.
- La base efímera no contiene los 15 usuarios Auth ni los perfiles de Supabase Test. Las suites que necesitan un usuario real o un JWT de PostgREST siguen siendo opt-in y no corren en este job.
- Las claves que imprime el CLI son las de la demo local, distintas de test y de producción. El script no las copia a los documentos.
