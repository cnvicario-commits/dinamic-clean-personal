# Imagen

`deploy/Dockerfile.frontend` construye solo el frontend. El Dockerfile de `apps/api` no se modificó.

Etapas: `npm ci` con el lockfile, build con `output: "standalone"`, runtime con Node 22. El runtime no trae el código fuente ni las herramientas de desarrollo. El usuario es `dinamic`, uid y gid `10001`. `NODE_ENV=production`. El proceso escucha en el puerto `3000` y reenvía `SIGTERM`.

El guard corre antes del build. Después del build se revisa que `.next/static` y `.next/standalone` no contengan el project ref de producción ni una asignación de `DATABASE_URL`, `MIGRATIONS_DATABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`. El script del guard nombra el ref productivo para poder rechazarlo. Eso no es una credencial embebida.

`.dockerignore` deja afuera `.env`, `apps`, `node_modules`, certificados y tests.

## Sonda local

Se construyó `dinamic-clean-frontend:abc1234` con la URL de Test, una clave `sb_publishable_` de prueba y `https://cristian-frontend.invalid`. No es una imagen desplegable: el preflight rechaza `.invalid`.

| Comprobación | Resultado |
| --- | --- |
| Tamaño | 106172634 bytes |
| Usuario | `10001:10001` |
| Privileged | false |
| Memoria de la sonda | 512 MB |
| CPU de la sonda | 0.5 |
| Límite de procesos de la sonda | 256 |
| Puerto | `127.0.0.1:18086` hacia el `3000` |
| `/api/healthz` | `status=ok`, release `abc1234`, deployment `cristian-pruebas` |
| `/login` | HTTP 200, con el cartel de pruebas |
| Healthcheck | healthy |
| Reinicio | `/api/healthz` volvió a responder |
| `docker stop` | exit 0 |
| Logs | sin la clave de prueba, sin `DATABASE_URL` y sin el ref productivo |
| Bundle | `CRISTIAN_FRONTEND_BUNDLE_OK` |

La imagen de sonda se borró al terminar. Los límites de 0.5 CPU y 512 MB fueron de esa sonda, no la reserva del VPS.
