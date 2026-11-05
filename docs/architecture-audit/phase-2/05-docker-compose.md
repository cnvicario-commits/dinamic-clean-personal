# Docker Compose

Archivo: `deploy/docker-compose.cristian.yml`.

Incluye proyecto `dinamic-clean-cristian`, imagen `dinamic-clean-api:<sha>`, red propia, publicación solo en loopback, `restart: unless-stopped`, healthcheck de `/readyz`, límites obligatorios de CPU y memoria, logs `json-file` de 10m por 5 archivos, usuario `10001:10001`, `no-new-privileges`, `cap_drop: ALL` y `MIGRATIONS_DATABASE_URL` vacío.

`scripts/check-cristian-compose.sh` renderizó el archivo. Resultado: `compose_config_ok`. La sonda de sintaxis no es una decisión de capacidad.

## Imagen

`apps/api/Dockerfile` sigue siendo el único Dockerfile de la API. Acepta `APP_RELEASE_SHA` y lo deja en el entorno. El build de prueba usó `abc1234`.

Comprobado en esa imagen, que después se borró:

- usuario `dinamic`
- el historial de build no contiene `service_role`, `password`, `postgres://` ni `secret`
- `GET /healthz` respondió `200` y `{"status":"ok","release":"abc1234"}`
- `GET /readyz` respondió `503` contra un Postgres inalcanzable, así que no declara listo sin base
- `SIGTERM` terminó el proceso con código 0

No se apuntó esa imagen a Supabase Test ni a producción. `/readyz` 200 contra Test sigue siendo el de la fase 1, con el mismo código de probes, fuera de esta imagen.
