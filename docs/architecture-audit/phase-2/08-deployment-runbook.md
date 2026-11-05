# Runbook

La API de Cristian está en `127.0.0.1:3006`, con 1 CPU y 512 MB. Producción está en el puerto `3005`. Estos comandos no tocan ese contenedor, no copian `.env` y no reemplazan el certificado.

`CORS_ORIGIN=https://demo.example.com` sigue siendo un placeholder. No es un origen válido para el frontend.

`scripts/check-cristian-compose.sh` solo prueba la sintaxis con un certificado temporal. `docker compose config` no es el preflight. Cualquier script o workflow que vaya a recrear el contenedor tiene que ejecutar antes `scripts/preflight-cristian-deploy.sh`. El único script de este repositorio que recrea la API es `scripts/redeploy-cristian-api.sh`, y llama al preflight primero.

## Certificado

El archivo del VPS es `/opt/dinamic-clean-cristian/certs/supabase-ca.crt`. No se versiona. OpenSSL tiene que poder leerlo como X.509. El montaje es de solo lectura y `NODE_EXTRA_CA_CERTS` apunta a `/app/certs/supabase-ca.crt`. `rejectUnauthorized` sigue activo. No usar `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Instalación o renovación, sin borrar el `.env`:

```bash
sudo install -d -m 755 /opt/dinamic-clean-cristian/certs
sudo install -m 644 -o root -g root supabase-ca.crt /opt/dinamic-clean-cristian/certs/supabase-ca.crt
```

Después de reemplazar el archivo hay que recrear el proceso para que Node vuelva a cargar la CA. El preflight tiene que imprimir `CA_FILE_OK` y `preflight_ok`.

## Actualizar un checkout que ya tiene el Compose editado a mano

En el VPS, dentro del checkout de Cristian. No entrar a `/opt/dinamic-clean`.

```bash
cd /opt/dinamic-clean-cristian
git status --short -- deploy/docker-compose.cristian.yml
git diff -- deploy/docker-compose.cristian.yml
```

Conservar `.env` y `certs/`. No hacer `git checkout -- .env` ni copiar un env de producción. Si el diff local solo agrega la CA que ahora está en `DIN-417`, se puede descartar esa parte del archivo después de comparar. Si hay otra línea local que el branch no trae, dejarla anotada y no pisarla a ciegas.

Publicar la corrección en `DIN-417` desde la máquina de desarrollo, sin merge a `main`:

```bash
git switch DIN-417
git push -u origin DIN-417
```

En el VPS, traer solo ese branch:

```bash
git fetch origin DIN-417
git switch DIN-417
git pull --ff-only origin DIN-417
```

Variables del despliegue ya medido:

```bash
export APP_RELEASE_SHA="$(git rev-parse --short=12 HEAD)"
export CRISTIAN_API_HOST_PORT=3006
export CRISTIAN_API_CPUS=1
export CRISTIAN_API_MEMORY=512m
export CRISTIAN_SUPABASE_CA_FILE=/opt/dinamic-clean-cristian/certs/supabase-ca.crt
export CRISTIAN_ENV_FILE=/opt/dinamic-clean-cristian/.env
./scripts/preflight-cristian-deploy.sh
./scripts/redeploy-cristian-api.sh
```

`redeploy-cristian-api.sh` vuelve a correr el preflight y después ejecuta `docker compose up -d --no-deps --force-recreate api`.

## Verificación

```bash
curl -fsS http://127.0.0.1:3006/healthz
curl -fsS http://127.0.0.1:3006/readyz
docker inspect --format '{{.State.Health.Status}}' dinamic-clean-cristian-api
curl -fsS http://127.0.0.1:3005/healthz
```

El SHA de `/healthz` tiene que coincidir con `APP_RELEASE_SHA`. El contenedor de Cristian tiene que quedar `healthy`. El `/healthz` del puerto `3005` confirma que producción sigue respondiendo. No alcanza con el preflight de Cristian para afirmar el estado de producción: hay que hacer esa consulta.

Consulta y logs, solo del proyecto demo:

```bash
docker compose -f deploy/docker-compose.cristian.yml ps
docker compose -f deploy/docker-compose.cristian.yml logs --tail 100 api
docker stats --no-stream dinamic-clean-cristian-api
```

Volver atrás: exportar el SHA anterior y repetir el preflight y `./scripts/redeploy-cristian-api.sh`. No borrar imágenes de producción.

## Usuario de deploy

No agregar un usuario `deploy-cristian` al grupo `docker`. Ese grupo equivale a root en el host y alcanza al contenedor de producción.

El mecanismo queda diseñado y no implementado: un wrapper de root, con una lista cerrada de subcomandos, que solo puede ejecutar el preflight y `scripts/redeploy-cristian-api.sh`. Un workflow modificable desde `cristian-pruebas` no debe recibir acceso al daemon.
