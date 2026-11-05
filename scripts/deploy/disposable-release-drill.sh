#!/usr/bin/env bash
# Disposable Compose drill. It creates and removes only dinamic-crtest-* resources.
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "DOCKER_INTEGRATION_NOT_VERIFIED"
  exit 2
fi

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
suffix="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
prefix="dinamic-crtest${suffix}"
project="dinamic-crtest-${suffix}"
prod_project="dinamic-crtest-p${suffix}"
sha_a="$(python3 -c 'print("a"*40)')"
sha_b="$(python3 -c 'print("b"*40)')"
port_a="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
port_f="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
port_p="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
for port in "$port_a" "$port_f" "$port_p"; do
  [[ "$port" != *3005* && "$port" != *3006* && "$port" != *8086* ]]
done

compose="$work/compose.yml"
prod_compose="$work/production.yml"
dest="$work/privileged"
state="$work/state"
image_a=""
image_b=""

cleanup() {
  if [[ -f "$compose" ]]; then
    docker compose -f "$compose" down >/dev/null 2>&1 || true
  fi
  if [[ -f "$prod_compose" ]]; then
    docker compose -f "$prod_compose" down >/dev/null 2>&1 || true
  fi
  docker rmi \
    "${prefix}-api:${sha_a}" "${prefix}-frontend:${sha_a}" \
    "${prefix}-api:${sha_b}" "${prefix}-frontend:${sha_b}" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work/image"
cat > "$work/image/serve.sh" <<'EOF'
#!/bin/sh
sha=$(cat /release)
mkdir -p /www/api
if [ "$KIND" = "frontend" ]; then
  printf '{"status":"ok","release":"%s","deployment":"cristian-pruebas"}' "$sha" > /www/api/healthz
  printf 'ok' > /www/login
else
  printf '{"status":"ok","release":"%s"}' "$sha" > /www/healthz
  printf '{"status":"ready"}' > /www/readyz
fi
exec httpd -f -p 8080 -h /www
EOF
cat > "$work/image/health.sh" <<'EOF'
#!/bin/sh
if [ "$KIND" = "frontend" ]; then
  wget -q -O - http://127.0.0.1:8080/api/healthz >/dev/null
else
  wget -q -O - http://127.0.0.1:8080/healthz >/dev/null
fi
EOF
cat > "$work/image/Dockerfile" <<'EOF'
FROM busybox:1.36
ARG RELEASE_SHA
RUN printf '%s' "$RELEASE_SHA" > /release
COPY serve.sh /serve.sh
COPY health.sh /health.sh
HEALTHCHECK --interval=1s --timeout=1s --retries=20 CMD /bin/sh /health.sh
CMD ["/bin/sh", "/serve.sh"]
EOF

docker build -t "${prefix}-api:${sha_a}" --build-arg "RELEASE_SHA=${sha_a}" "$work/image" >/dev/null
docker tag "${prefix}-api:${sha_a}" "${prefix}-frontend:${sha_a}"
docker build -t "${prefix}-api:${sha_b}" --build-arg "RELEASE_SHA=${sha_b}" "$work/image" >/dev/null
docker tag "${prefix}-api:${sha_b}" "${prefix}-frontend:${sha_b}"
image_a="$(docker image inspect --format '{{.Id}}' "${prefix}-api:${sha_a}")"
image_b="$(docker image inspect --format '{{.Id}}' "${prefix}-api:${sha_b}")"

cat > "$compose" <<EOF
name: ${project}
services:
  api:
    image: ${prefix}-api:\${APP_RELEASE_SHA}
    container_name: ${prefix}-api
    environment:
      KIND: api
      APP_RELEASE_SHA: \${APP_RELEASE_SHA}
      APP_DEPLOYMENT_ENV: cristian-pruebas
      EXPECTED_SUPABASE_PROJECT_REF: edruejzwwnixsjsadbgb
    ports:
      - "127.0.0.1:${port_a}:8080"
  frontend:
    image: ${prefix}-frontend:\${APP_RELEASE_SHA}
    container_name: ${prefix}-frontend
    environment:
      KIND: frontend
      APP_RELEASE_SHA: \${APP_RELEASE_SHA}
      APP_DEPLOYMENT_ENV: cristian-pruebas
      EXPECTED_SUPABASE_PROJECT_REF: edruejzwwnixsjsadbgb
    ports:
      - "127.0.0.1:${port_f}:8080"
EOF
cat > "$prod_compose" <<EOF
name: ${prod_project}
services:
  api:
    image: ${prefix}-api:\${APP_RELEASE_SHA}
    container_name: ${prefix}-papi
    environment:
      KIND: api
      APP_RELEASE_SHA: \${APP_RELEASE_SHA}
      APP_DEPLOYMENT_ENV: production
    ports:
      - "127.0.0.1:${port_p}:8080"
EOF

bash "$repo/scripts/deploy/print-privileged-install.sh" --apply-to "$dest" >/dev/null
cp "$compose" "$dest/compose/drill.yml"
cp "$prod_compose" "$dest/compose/production.yml"
compose="$dest/compose/drill.yml"
prod_compose="$dest/compose/production.yml"
common=(
  DINAMIC_DISPOSABLE_DOCKER=1
  DINAMIC_PRIVILEGED_ROOT="$dest"
  DINAMIC_RELEASE_STATE_DIR="$state"
  DINAMIC_DISPOSABLE_IMAGE_PREFIX="$prefix"
  PROBE_ATTEMPTS=20
)
apply() {
  env "${common[@]}" DINAMIC_COMPOSE_FILE="$compose" CRISTIAN_API_HOST_PORT="$port_a" CRISTIAN_FRONTEND_HOST_PORT="$port_f" \
    bash "$dest/bin/cristian-apply" "$@"
}
roll() {
  env "${common[@]}" DINAMIC_COMPOSE_FILE="$compose" CRISTIAN_API_HOST_PORT="$port_a" CRISTIAN_FRONTEND_HOST_PORT="$port_f" \
    bash "$dest/bin/cristian-rollback" "$@"
}

APP_RELEASE_SHA="$sha_a" docker compose -f "$compose" up -d --no-build api >/dev/null
healthy=""
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${prefix}-api" 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then healthy=1; break; fi
  sleep 1
done
if [[ -z "$healthy" ]]; then
  docker logs "${prefix}-api" >&2 || true
  echo "DRILL_UNHEALTHY ${status:-missing}" >&2
  exit 1
fi
container_before="$(docker inspect --format '{{.Id}}' "${prefix}-api")"
set +e
adopt_err="$(env "${common[@]}" ADOPT_CONFIRM=adopt-running ADOPT_RUN_ID=1 ADOPT_CONTAINER="${prefix}-api" ADOPT_PORT="$port_a" \
  bash "$dest/bin/adopt-release" cristian api 2>&1)"
adopt_status=$?
set -e
container_after="$(docker inspect --format '{{.Id}}' "${prefix}-api")"
[[ "$container_before" == "$container_after" ]]
if [[ "$adopt_status" -eq 0 ]]; then
  printf '%s\n' "$adopt_err" | grep -q 'ADOPT_RECORDED'
  node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.current.gitSha!==process.argv[2]) process.exit(1)' \
    "$state/cristian/api.json" "$sha_a"
else
  printf '%s\n' "$adopt_err" | grep -q 'ADOPT_MANUAL'
  [[ ! -f "$state/cristian/api.json" ]]
fi

apply api "$sha_a" "$image_a" 2 >/dev/null
apply frontend "$sha_a" "$image_a" 1 >/dev/null
frontend_before="$(docker compose -f "$compose" ps -q frontend)"
apply api "$sha_b" "$image_b" 3 >/dev/null
frontend_after="$(docker compose -f "$compose" ps -q frontend)"
[[ "$frontend_before" == "$frontend_after" ]]
[[ "$(docker inspect --format '{{.Image}}' "$(docker compose -f "$compose" ps -q api)")" == "$image_b" ]]
roll api >/dev/null
[[ "$(docker inspect --format '{{.Image}}' "$(docker compose -f "$compose" ps -q api)")" == "$image_a" ]]
[[ "$(docker compose -f "$compose" ps -q frontend)" == "$frontend_before" ]]
node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.current.gitSha!==process.argv[2]||r.previous.gitSha!==process.argv[3]) process.exit(1)' \
  "$state/cristian/api.json" "$sha_a" "$sha_b"

apply frontend "$sha_b" "$image_b" 2 >/dev/null
api_during_frontend="$(docker inspect --format '{{.Image}}' "$(docker compose -f "$compose" ps -q api)")"
roll frontend >/dev/null
[[ "$api_during_frontend" == "$image_a" ]]
[[ "$(docker inspect --format '{{.Image}}' "$(docker compose -f "$compose" ps -q frontend)")" == "$image_a" ]]

lock="$state/cristian/api.flock"
ready="$lock.ready"
# READY is read by the inner bash, not by this shell.
# shellcheck disable=SC2016
READY="$ready" python3 "$dest/bin/with-service-lock.py" "$lock" bash -c 'printf ready > "$READY"; sleep 8' &
holder=$!
ready_seen=""
for _ in $(seq 1 50); do
  if [[ -f "$ready" ]]; then ready_seen=1; break; fi
  sleep 0.05
done
[[ -n "$ready_seen" ]]
set +e
blocked="$(env "${common[@]}" DINAMIC_COMPOSE_FILE="$compose" CRISTIAN_API_HOST_PORT="$port_a" \
  bash "$dest/bin/cristian-apply" api "$sha_b" "$image_b" 3 2>&1)"
blocked_status=$?
set -e
kill "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null || true
[[ "$blocked_status" -ne 0 ]]
printf '%s\n' "$blocked" | grep -q 'OPERATION_REJECTED locked'
[[ "$(docker inspect --format '{{.Image}}' "$(docker compose -f "$compose" ps -q api)")" == "$image_a" ]]

env "${common[@]}" PRODUCTION_COMPOSE_REVIEWED=operator-reviewed PRODUCTION_COMPOSE_FILE="$prod_compose" PRODUCTION_API_HOST_PORT="$port_p" \
  bash "$dest/bin/production-apply" "$sha_a" "$image_a" 1 >/dev/null
env "${common[@]}" PRODUCTION_COMPOSE_REVIEWED=operator-reviewed PRODUCTION_COMPOSE_FILE="$prod_compose" PRODUCTION_API_HOST_PORT="$port_p" \
  bash "$dest/bin/production-apply" "$sha_b" "$image_b" 2 >/dev/null
[[ "$(docker inspect --format '{{.Image}}' "$(docker compose -f "$prod_compose" ps -q api)")" == "$image_b" ]]
env "${common[@]}" PRODUCTION_COMPOSE_REVIEWED=operator-reviewed PRODUCTION_COMPOSE_FILE="$prod_compose" PRODUCTION_API_HOST_PORT="$port_p" \
  bash "$dest/bin/production-rollback" >/dev/null
[[ "$(docker inspect --format '{{.Image}}' "$(docker compose -f "$prod_compose" ps -q api)")" == "$image_a" ]]
node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.current.gitSha!==process.argv[2]||r.previous.gitSha!==process.argv[3]) process.exit(1)' \
  "$state/production/api.json" "$sha_a" "$sha_b"

echo "DOCKER_RELEASE_RESTORED ${project}"
