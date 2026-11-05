# 01 — Verificación del VPS

Estado: `NOT_ACCESSIBLE`.

No hay SSH config en esta máquina, no hay host de producción en el repositorio y no se abrió ninguna sesión al servidor. No se inventan contenedores, puertos, certificados ni capacidad libre.

Lo único verificable sobre el deploy sigue estando en el repo:

- `apps/api/Dockerfile` publica el puerto 3001 y corre como uid 10001.
- `deploy/docker-compose.api.yml` es un solo servicio, sin límites de CPU/RAM, sin volumen de datos y sin red con nombre fijo.
- No hay configuración de Nginx ni de certificados en el repositorio.
- `apps/api/README.md` cita `docs/phase-1-deploy-runbook.md` y ese archivo no existe.

Por eso no se puede afirmar que el VPS alcance para una segunda instancia, ni qué puertos, redes o archivos compartiría con producción.

## Script de relevamiento

Ejecutarlo un administrador, en el VPS, con un usuario de lectura. La salida se puede pegar en el informe. No imprime `.env`, connection strings ni valores de variables.

```bash
#!/usr/bin/env bash
# Read-only survey. Do not pass --env-file contents to the terminal.
set -u
echo "=== host ==="
uname -srm
date -u +%Y-%m-%dT%H:%MZ
echo "=== cpu mem disk ==="
nproc
free -h
df -hT /
echo "=== docker ==="
docker version --format 'server {{.Server.Version}}'
docker ps --format 'name={{.Names}} image={{.Image}} status={{.Status}} ports={{.Ports}}'
echo "=== resources per container ==="
docker stats --no-stream --format 'name={{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}'
echo "=== limits networks restart ==="
for id in $(docker ps -q); do
  docker inspect --format 'name={{.Name}} memory={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}} restart={{.HostConfig.RestartPolicy.Name}} network={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$id"
done
echo "=== compose labels ==="
docker ps -q | xargs -r docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.project.working_dir"}} {{.Name}}'
echo "=== volumes ==="
docker volume ls
echo "=== supabase refs in container env, not URLs ==="
for id in $(docker ps -q); do
  name=$(docker inspect --format '{{.Name}}' "$id")
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | awk -F= '/^(SUPABASE_URL|DATABASE_URL|CORS_ORIGIN|NODE_ENV|PORT|HOST)=/ {
        key=$1
        if (key=="SUPABASE_URL" || key=="DATABASE_URL") {
          if (match($0, /[a-z0-9]{20}/)) print name, key, "ref=" substr($0, RSTART, RLENGTH)
          else print name, key, "present_ref_unparsed"
        } else print name, $0
      }'
done
echo "=== nginx names ==="
if command -v nginx >/dev/null; then
  sudo nginx -T 2>/dev/null | awk '$1=="server_name" || $1=="listen" || $1=="proxy_pass" {print}'
else
  echo "nginx_not_in_path"
fi
echo "=== certificates ==="
if command -v certbot >/dev/null; then
  sudo certbot certificates 2>/dev/null | awk '/Certificate Name|Domains:|Expiry Date:/ {print}'
else
  echo "certbot_not_installed"
fi
echo "=== listeners ==="
ss -lntup | awk 'NR==1 || /nginx|docker|node/ {print $1,$4,$6}'
echo "=== backup timers ==="
systemctl list-timers --all --no-pager 2>/dev/null | awk 'NR==1 || /backup|dump|pg|supabase|restic|borg/ {print}'
echo "=== log drivers ==="
docker ps -q | xargs -r docker inspect --format '{{.Name}} log={{.HostConfig.LogConfig.Type}}'
```

Qué tiene que responder el resultado para destrabar la fase:

| Pregunta | Dato que se espera |
|----------|--------------------|
| ¿Hay un API de producción corriendo? | Nombre del contenedor, imagen y puerto |
| ¿Qué project ref usa? | Solo el ref, comparado con `biectbcujabpjhinouil` |
| ¿Qué se compartiría con un segundo stack? | Red Docker, archivo `.env`, puerto 3001, vhost default |
| ¿Hay margen? | `free`, `df` y `docker stats` |
| ¿Cómo se despliega hoy? | Si no aparece un timer ni un runner, el deploy sigue siendo manual |
| ¿Hay backup? | Un timer o la ausencia explícita |

Hasta recibir esa salida, la decisión “mismo VPS” queda pendiente. La decisión por defecto, si el relevamiento muestra un solo Compose y RAM libre mayor que el límite que se le ponga al segundo contenedor, sigue siendo el mismo VPS con usuario, puerto, vhost y env distintos. Si el ref de producción aparece en el mismo env que se reutilizaría, se frena el segundo contenedor.
