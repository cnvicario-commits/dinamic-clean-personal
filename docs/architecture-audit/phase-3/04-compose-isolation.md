# Compose

El frontend vive en `deploy/docker-compose.cristian-frontend.yml`. Es otro proyecto Compose, `dinamic-clean-cristian-frontend`, y usa como red externa `dinamic-clean-cristian`. Así este archivo no describe la API y no puede recrearla. No hay que pasar `--remove-orphans`.

Contenedor: `dinamic-clean-cristian-frontend`.

Publicación: `0.0.0.0:${CRISTIAN_FRONTEND_HOST_PORT}:3000`. En esta etapa el puerto es `8086`. No se enlaza la IP pública: no se verificó en una interfaz local y, con NAT, suele no estar en el host. No hay default de CPU, memoria ni puerto. `restart: unless-stopped`. Usuario `10001:10001`. Sin privilegios nuevos, sin capabilities, `pids_limit: 256`, logs de 10 MB por 5 archivos y healthcheck a `/api/healthz`.

No monta el socket de Docker, ni el `.env` de la API, ni `/opt/dinamic-clean`. No toca el volumen de la CA. `API_URL` apunta a `http://dinamic-clean-cristian-api:3001`.

`scripts/check-cristian-frontend-compose.sh` solo renderiza la sintaxis con un origen `.invalid`. `docker compose config` no reemplaza a `scripts/preflight-cristian-frontend.sh`. `scripts/redeploy-cristian-frontend.sh` corre el preflight, exige que la red ya exista y ejecuta `up -d --no-deps --no-build --force-recreate frontend`.

El frontend puede estar levantado aunque la API no responda. El healthcheck no consulta la API, así que un corte del backend no reinicia el frontend. Las pantallas que llaman a la API muestran el error de esa llamada.

La imagen se etiqueta `dinamic-clean-frontend:${APP_RELEASE_SHA}`. Para volver atrás se repite el build y el preflight con el SHA anterior. No se usa `docker system prune`.
