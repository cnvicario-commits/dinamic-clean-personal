# Runbook

Publicación pedida: `http://170.239.85.196:8086` y `http://170.239.85.196:3006`. HTTP no protege credenciales. Usar solo cuentas y datos de prueba. Estos comandos no se ejecutaron en el VPS.

No copiar el `.env` de producción, no reemplazar `supabase-ca.crt` y no usar `--remove-orphans` ni `docker system prune`.

## 1. Código

En la máquina de desarrollo, sin merge:

```bash
git switch DIN-417
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git push -u origin DIN-417
```

## 2. Checkout del VPS

```bash
cd /opt/dinamic-clean-cristian
cp -a .env ".env.bak-$(date -u +%Y%m%dT%H%M%SZ)"
cp -a deploy/docker-compose.cristian.yml "deploy/docker-compose.cristian.yml.bak-$(date -u +%Y%m%dT%H%M%SZ)"
git status --short
git fetch origin DIN-417
git switch DIN-417
git pull --ff-only origin DIN-417
```

Conservar `.env` y `certs/`. No entrar a `/opt/dinamic-clean`. Si el pull no es fast-forward, parar y comparar el Compose local con el del branch. El archivo versionado ya monta la CA y publica `0.0.0.0`.

## 3. Recursos, puertos y firewall

```bash
free -h
nproc
df -h /
ss -ltn 'sport = :8086'
ss -ltn 'sport = :3005'
ss -ltn 'sport = :3006'
ip -4 addr
sudo iptables -S DOCKER-USER
sudo ufw status
```

`8086` tiene que estar libre. `3005` sigue siendo producción. `3006` está ocupado por la API actual en loopback; el redeploy lo pasa a `0.0.0.0`. No se comprobó que `170.239.85.196` esté en una interfaz local, por eso el bind es `0.0.0.0`. Docker puede abrir el puerto aunque UFW diga que está cerrado. No cambiar reglas en esta preparación: mirarlas y anotarlas.

Elegir CPU y memoria con esta medición. La API ya usa 1 CPU y 512 MB.

## 4. Variables y preflight

En `.env` de la API, dejar una sola línea:

```bash
CORS_ORIGIN=http://170.239.85.196:8086
```

No imprimir el archivo. Después:

```bash
export APP_RELEASE_SHA="$(git rev-parse --short=12 HEAD)"
export APP_DEPLOYMENT_ENV=cristian-pruebas
export CRISTIAN_API_HOST_PORT=3006
export CRISTIAN_API_CPUS=1
export CRISTIAN_API_MEMORY=512m
export CRISTIAN_SUPABASE_CA_FILE=/opt/dinamic-clean-cristian/certs/supabase-ca.crt
export CRISTIAN_ENV_FILE=/opt/dinamic-clean-cristian/.env
./scripts/preflight-cristian-deploy.sh
```

Tiene que imprimir `CA_FILE_OK` y `preflight_ok`.

```bash
export CRISTIAN_FRONTEND_HOST_PORT=8086
export CRISTIAN_FRONTEND_CPUS=<cpu-medida>
export CRISTIAN_FRONTEND_MEMORY=<memoria-medida>
export CRISTIAN_NEXT_PUBLIC_SUPABASE_URL=https://edruejzwwnixsjsadbgb.supabase.co
export CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-de-test>
export CRISTIAN_NEXT_PUBLIC_API_URL=http://170.239.85.196:3006
./scripts/preflight-cristian-frontend.sh
```

Tiene que imprimir `frontend_preflight_ok`. `docker compose config` no reemplaza a ninguno de los dos.

En Supabase Test, Site URL y Redirect URLs: `http://170.239.85.196:8086`. No tocar el proyecto productivo.

## 5. Arranque

El CORS y la publicación de la API cambian, así que la API se recrea una vez. El frontend se construye y arranca aparte.

```bash
./scripts/redeploy-cristian-api.sh
docker compose -f deploy/docker-compose.cristian-frontend.yml build frontend
./scripts/redeploy-cristian-frontend.sh
```

## 6. Verificación

En el VPS:

```bash
curl -fsS http://127.0.0.1:8086/api/healthz
curl -fsS http://127.0.0.1:3006/healthz
curl -fsS http://127.0.0.1:3006/readyz
curl -fsS http://127.0.0.1:3005/healthz
docker inspect --format '{{.State.Health.Status}}' dinamic-clean-cristian-frontend
docker inspect --format '{{.State.Health.Status}}' dinamic-clean-cristian-api
```

Desde otra computadora o un celular, sin VPN:

```text
http://170.239.85.196:8086
http://170.239.85.196:3006/healthz
```

Probar login con un usuario de Test, un módulo, una llamada a la API y el logout. Esas pruebas no están hechas. El acceso externo tampoco: no se declara hasta verlo en el VPS.

## Rollback

Frontend: exportar el SHA anterior, repetir el preflight del frontend, el build y `./scripts/redeploy-cristian-frontend.sh`.

API: restaurar el `.env` de respaldo si se quiere el CORS anterior, exportar el SHA anterior y correr `./scripts/redeploy-cristian-api.sh`. No borrar imágenes de producción.

## Diagnóstico

```bash
docker compose -f deploy/docker-compose.cristian-frontend.yml ps
docker compose -f deploy/docker-compose.cristian-frontend.yml logs --tail 100 frontend
docker compose -f deploy/docker-compose.cristian.yml logs --tail 100 api
docker stats --no-stream dinamic-clean-cristian-frontend dinamic-clean-cristian-api
```
