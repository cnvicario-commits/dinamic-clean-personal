# Runbook

Estos comandos se ejecutan en el VPS, dentro de `/opt/dinamic-clean-cristian`, después del relevamiento. No se ejecutaron en esta fase. No incluyen `docker compose down` de otro proyecto, `docker system prune` ni recarga de Nginx productivo.

Variables que tienen que existir antes del primer arranque: `APP_RELEASE_SHA`, `CRISTIAN_API_HOST_PORT`, `CRISTIAN_API_CPUS`, `CRISTIAN_API_MEMORY` y `CRISTIAN_ENV_FILE` apuntando al env de Test, nunca al de producción.

```bash
docker compose -f deploy/docker-compose.cristian.yml ps
docker compose -f deploy/docker-compose.cristian.yml logs --tail 100 api
docker stats --no-stream dinamic-clean-cristian-api
curl -fsS http://127.0.0.1:${CRISTIAN_API_HOST_PORT}/healthz
curl -fsS http://127.0.0.1:${CRISTIAN_API_HOST_PORT}/readyz
docker compose -f deploy/docker-compose.cristian.yml restart api
```

Imagen nueva, solo de este proyecto:

```bash
APP_RELEASE_SHA="$(git rev-parse --short=12 HEAD)"
docker compose -f deploy/docker-compose.cristian.yml build
docker compose -f deploy/docker-compose.cristian.yml up -d
```

Volver atrás: exportar el SHA anterior y repetir `up -d`. No borrar imágenes productivas.

## Usuario de deploy

No agregar un usuario `deploy-cristian` al grupo `docker`. Ese grupo equivale a root en el host y alcanza al contenedor de producción.

El mecanismo queda diseñado y no implementado: un wrapper de root, con una lista cerrada de subcomandos, que solo puede construir y reiniciar el proyecto `dinamic-clean-cristian`. No hay clave SSH ni secreto de deploy en esta fase. Un workflow modificable desde `cristian-pruebas` no debe recibir acceso al daemon.
