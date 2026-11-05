#!/usr/bin/env bash
# Read-only VPS survey. Run on the server. Do not print .env values or connection strings.
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
    | awk -v name="$name" -F= '/^(SUPABASE_URL|DATABASE_URL|CORS_ORIGIN|NODE_ENV|PORT|HOST)=/ {
        key=$1
        if (key=="SUPABASE_URL" || key=="DATABASE_URL") {
          ref="present_ref_unparsed"
          if (match($0, /[a-z0-9]{20}\.supabase\.co/)) ref=substr($0, RSTART, 20)
          else if (match($0, /(postgres|dinamic_api)\.[a-z0-9]{20}/)) ref=substr($0, RSTART + index(substr($0, RSTART), "."), 20)
          print name, key, "ref=" ref
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
