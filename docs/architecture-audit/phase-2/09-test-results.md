# Resultados

## Despliegue verificado en el VPS

La API de Cristian quedó publicada en el puerto de loopback `3006`, contra Supabase Test. Comprobado en ese despliegue:

- `GET /healthz` HTTP 200, release `d713fb79ade3`.
- `GET /readyz` HTTP 200.
- PostgreSQL negocia TLS con la CA oficial de Supabase. El error previo `SELF_SIGNED_CERT_IN_CHAIN` se corrigió montando esa CA, sin desactivar la verificación.
- El contenedor de producción no fue modificado.

`CORS_ORIGIN=https://demo.example.com` está en ese entorno solo como placeholder. No habilita el frontend.

## Preflight de CA, ejecutado en esta sesión

| Comando | Resultado |
| --- | --- |
| `apps/api` `npm test` | exit 0. 67 archivos pasaron, 18 skipped. 437 tests pasaron, 80 skipped |
| `apps/api` `npm run lint`, `typecheck`, `build` | exit 0 |
| `tests/cristian-ca-mount.test.ts` | exit 0. 6 tests |
| `./scripts/check-cristian-compose.sh` | exit 0. Imprime `syntax_check_only` y `docker_compose_config_is_not_a_deploy_preflight` |
| Preflight sin `CRISTIAN_SUPABASE_CA_FILE` | exit 1, `PREFLIGHT_REJECTED missing-CRISTIAN_SUPABASE_CA_FILE` |
| Preflight con encabezados PEM que no son X.509 | exit 1, `CA_FILE_REJECTED not-x509` |
| Preflight con puerto `3005` | exit 1, `PREFLIGHT_REJECTED production_port` |
| Preflight con `NODE_TLS_REJECT_UNAUTHORIZED=0` | exit 1, `PREFLIGHT_REJECTED tls_verification_disabled` |
| Preflight con un X.509 de prueba, puerto `3006`, 1 CPU y 512 MB | exit 0, `CA_FILE_OK` y `preflight_ok` |
| `git diff --check` | exit 0 |

Ese preflight exitoso usó un certificado generado para la prueba, no el archivo del VPS. No se recreó el contenedor.

## Pruebas locales anteriores, antes de incorporar la CA al repositorio

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
