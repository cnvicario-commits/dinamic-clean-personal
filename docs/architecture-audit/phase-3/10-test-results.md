# Pruebas

## Acceso HTTP por IP

Ejecutado al adaptar la publicación `http://170.239.85.196`. No se levantó un contenedor nuevo y no se tocó el VPS.

| Comando | Resultado |
| --- | --- |
| `npm test` en la raíz | exit 0. 19 tests |
| `npm run lint` y `npm run build` en la raíz | exit 0. Lint con 2 warnings previos |
| `apps/api` `npm test` | exit 0. 438 pasaron, 80 skipped |
| `apps/api` `npm run lint`, `typecheck`, `build` | exit 0 |
| `./scripts/check-cristian-compose.sh` | exit 0. Publica `0.0.0.0`, no la IP sin verificar |
| `./scripts/check-cristian-frontend-compose.sh` | exit 0 |
| Preflight del frontend con `http://170.239.85.196:3006` y puerto `8086` | exit 0, `frontend_preflight_ok` |
| Preflight de la API con CORS `*` | exit 1, `cors_wildcard` |
| Preflight de la API con el CORS HTTP, puerto `3006` y CA de prueba | exit 0, `CA_FILE_OK` y `preflight_ok` |

El guard acepta esa URL de API y rechaza otra IP, el puerto `3005` y Supabase producción. El login real y el acceso desde otro dispositivo siguen en `NOT_VERIFIED`.

## Sonda anterior

La sonda Docker usó una clave pública de prueba y `https://cristian-frontend.invalid`. Se borró al terminar. No es la imagen de esta publicación.

| Comando | Resultado |
| --- | --- |
| `npm test` | exit 0. 4 archivos, 19 tests |
| `npm run lint` | exit 0. 0 errores y 2 warnings previos en `src/app/login/page.tsx` y `src/components/UsuarioEstadoBoton.tsx` |
| `npm run build` | exit 0. Next.js 16.4.3, sin `CRISTIAN_FRONTEND_BUILD`, output por defecto |
| `npm audit --omit=dev` | exit 0. 0 vulnerabilidades |
| `./scripts/check-cristian-frontend-compose.sh` | exit 0. `syntax_check_only` y `frontend_compose_config_ok` |
| `./scripts/check-cristian-compose.sh` | exit 0. La sintaxis de la API sigue pasando |
| Preflight sin variables | exit 1, `missing-CRISTIAN_NEXT_PUBLIC_SUPABASE_URL` |
| Preflight con origen `.invalid` | exit 1, `browser-api-url-not-deployable` |
| Preflight con puerto `3005` | exit 1, `reserved_port` |
| Preflight con `https://pruebas.dinamic-clean.com`, puerto `8086`, 0.5 CPU y 512 MB | exit 0, `frontend_preflight_ok` |
| Render Nginx con `demo.example.com` | exit 1 |
| Render Nginx de fixture `pruebas.dinamic-clean.com` y puerto `8086` | exit 0. Ese hostname no es el dominio definitivo |
| Build de `deploy/Dockerfile.frontend` | exit 0. `CRISTIAN_FRONTEND_ENV_OK` y `CRISTIAN_FRONTEND_BUNDLE_OK` |
| Contenedor de sonda | `/api/healthz` 200, `/login` 200, healthy, usuario `10001:10001`, `docker stop` exit 0 |

`pruebas.dinamic-clean.com` solo demuestra que el render y el preflight aceptan un hostname concreto. No está registrado para este proyecto.

## No verificado

| Prueba | Estado |
| --- | --- |
| Login con usuario de Supabase Test | `NOT_VERIFIED` |
| Navegación autenticada, sesión y logout contra Test | `NOT_VERIFIED` |
| Llamada del navegador al backend de Cristian | `NOT_VERIFIED` |
| `nginx -t`, Certbot y DNS | `NOT_VERIFIED` |
| Arranque en el VPS | `NOT_VERIFIED` |
| Anon key real dentro de una imagen | `NOT_VERIFIED` |
