# Seguridad de runtime

La API de Cristian se identifica con `APP_DEPLOYMENT_ENV=cristian-pruebas`, no con `NODE_ENV=test`. El proceso publicado usa `NODE_ENV=production`.

`loadEnv` llama a `assertCristianPruebasDeployment` solo cuando esa identidad está presente. No hay una variable para desactivarla. Si la identidad no está, el arranque local y el de producción siguen igual.

Con la identidad demo, el proceso termina antes de escuchar si falla cualquiera de estas condiciones:

- `NODE_ENV` distinto de `production`
- `EXPECTED_SUPABASE_PROJECT_REF` distinto de `edruejzwwnixsjsadbgb`
- `SUPABASE_URL` que no sea `https://edruejzwwnixsjsadbgb.supabase.co`
- `DATABASE_URL` que no sea el host directo o el pooler de ese proyecto, base `postgres` y rol `dinamic_api`
- cualquier aparición de `biectbcujabpjhinouil`
- host no identificable
- `MIGRATIONS_DATABASE_URL` con valor
- CORS vacío, wildcard, `http` o loopback
- `TRUST_PROXY_CIDRS` vacío o `0.0.0.0/0`
- ausencia de `SUPABASE_SERVICE_ROLE_KEY`
- `APP_RELEASE_SHA` que no sea un SHA hex de 7 a 40 caracteres

Los mensajes de error no incluyen la URL ni la contraseña. La service role sigue solo en el servidor.

Tests ejecutados: demo rechaza producción, el pooler de producción y un host ambiguo; rechaza el rol `postgres` y una URL de migraciones; `NODE_ENV=test` y `SKIP_DEPLOYMENT_GUARD=1` no omiten el rechazo; sin la identidad demo, una URL de producción sigue cargando. Una imagen local con la identidad demo y la URL de producción salió con código 1 y `CRISTIAN_DEPLOYMENT_REJECTED SUPABASE_URL points at production`.
