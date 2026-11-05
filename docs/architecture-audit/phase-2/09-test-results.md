# Resultados

Ejecutado el 2026-11-05.

| Comando | Resultado |
| --- | --- |
| `apps/api` `npm test` | exit 0. 66 archivos pasaron, 18 skipped. 431 tests pasaron, 80 skipped |
| `apps/api` `npm run lint` | exit 0 |
| `apps/api` `npm run typecheck` | exit 0 |
| `apps/api` `npm run build` | exit 0 |
| `./scripts/check-cristian-compose.sh` | exit 0, `compose_config_ok` |
| Render Nginx con dominio de prueba | exit 0. Dominio vacío rechazado |
| `docker build` con `APP_RELEASE_SHA=abc1234` | exit 0. Imagen de prueba borrada al terminar |
| Imagen: usuario, `/healthz`, `/readyz` sin Postgres, `SIGTERM` | `dinamic`, HTTP 200 con el SHA, HTTP 503, exit 0 |
| Imagen con identidad demo y URL de producción | exit 1, `CRISTIAN_DEPLOYMENT_REJECTED` |
| `nginx -t`, Certbot, DNS, HTTPS público | no ejecutados. `nginx` y `certbot` no están en esta máquina |
| Relevamiento SSH | no ejecutado. No hay config SSH |

El lint del frontend, corrido aparte, terminó con 0 errores y 2 warnings previos en `src/app/login/page.tsx` y `src/components/UsuarioEstadoBoton.tsx`. No se modificaron.
