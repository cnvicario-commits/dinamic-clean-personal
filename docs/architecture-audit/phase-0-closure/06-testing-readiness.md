# 06 — Preparación de testing

Se revisa `docs/architecture-audit/05-testing-audit.md`. La dirección se sostiene: Supabase CLI efímero para el gate, y el proyecto cloud de test reservado al demo. Hay tres correcciones.

## CLI en esta máquina

`/opt/homebrew/bin/supabase` existe. `supabase --version` no llegó a imprimir: el CLI intenta escribir telemetría fuera del workspace y el sandbox lo impidió. La versión exacta queda pendiente. `supabase/config.toml` ya fija Postgres 17, el mismo major que los dos proyectos cloud (17.6). Auth local apunta a `http://127.0.0.1:3000`. No hay `signing_keys.json` commiteado.

## Qué reproduce el CLI y qué no

| Pieza | CLI local | Cloud de Dinamic |
|-------|-----------|------------------|
| SQL, roles `anon` / `authenticated` / `service_role`, RLS, Storage | Sí, si el job aplica baseline, grants y forward | Sí |
| Auth y JWT | Sí. El API prueba JWKS y, si falla, `SUPABASE_JWT_SECRET` | Producción usa JWKS. El fallback HMAC está en `apps/api/src/infrastructure/auth/jwt.ts` |
| Pooler, PITR, límites del plan, redirect URLs del dashboard | No | Sí |
| Datos y los 15 usuarios de test | No. El job crea los usuarios que el test necesita | Sí, y no deben usarse |
| Edge Functions | Irrelevante. La lista cloud está vacía | No hay |

El job de CI exporta `SUPABASE_URL` y `SUPABASE_JWT_SECRET` del `supabase start` que él mismo levantó, más `DATABASE_URL` de ese Postgres. `DB_COMPATIBILITY_TARGET=simulation`. Esa rama del guard en `apps/api/tests/supabase-test-guard.ts` exige host local y rechaza los dos refs cloud.

## Protección contra las dos bases persistentes

Hoy el guard, fuera del modo simulation, exige escribir en `EXPECTED_SUPABASE_TEST_PROJECT_REF`. Eso es el proyecto compartido. Varias suites ni siquiera llaman al guard: `http.integration.test.ts` abre `buildApp` si el proceso ya tiene `DATABASE_URL` y `SUPABASE_URL`. Vitest no carga `.env` por su cuenta (`apps/api/vitest.config.ts` no tiene `setupFiles`). Un shell que haya exportado `apps/api/.env` sí pega al proyecto de Cristian. El CI actual no exporta esas variables, así que hoy salta las suites y el job queda verde.

Cambios que el gate necesita, todavía no escritos:

1. Setup global de Vitest: si `DATABASE_URL` o `SUPABASE_URL` contiene `edruejzwwnixsjsadbgb` o `biectbcujabpjhinouil`, el proceso termina antes de cualquier test. No hay opt-in para esas dos bases.
2. Las suites que hoy miran solo el flag pasan por `assertDinamicCleanTestTarget` en modo simulation.
3. `npm test` se documenta y se ejecuta sin esas variables. El script puede hacer `unset` de `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `MIGRATIONS_DATABASE_URL` antes de Vitest.
4. El job de integración no hereda secretos de GitHub. Recibe las URLs del servicio que acaba de levantar.
5. Si `supabase start` falla, el job falla. Un `if: env falta` que saltea el job no sirve: GitHub trata el check saltado como cumplido y el PR entra igual.

## Checks obligatorios del PR a `auditoria-nasser`

Tienen que correr sobre el merge ref del PR (`pull_request`), no sobre un SHA viejo del ticket. Con la regla “branch up to date”, ese merge ref tiene el mismo árbol que va a quedar en `auditoria-nasser`. El SHA del commit en la rama y el SHA después del merge no son iguales. El deploy de `main` reconstruye el SHA de `main`. No promueve el tag armado en el PR.

Checks que bloquean:

- Frontend: `npm ci`, `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- API: `npm ci`, lint, typecheck, `npm test` sin base, `npm run build`.
- Integración: `supabase start`, baseline + `scripts/apply-forward-migrations.sh` contra esa base, suites de integración en modo simulation.
- `npm run export:contracts` y diff vacío de `src/lib/api/generated/`.
- Scan de secretos ya presente en `ci.yml`.
- Una revisión distinta del autor.

No bloquean todavía: cobertura numérica, E2E, smoke con MFA. No hay baseline de cobertura ni suite E2E.

El required check tiene que ser el que crea el workflow de la rama por defecto, no un check homónimo definido en el PR. Ese límite está en `03-github-security.md` y sigue sin verificarse en la cuenta.
