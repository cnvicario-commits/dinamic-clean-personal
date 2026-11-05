#!/usr/bin/env bash
# Restore the previous production API image. It does not roll back SQL.
set -euo pipefail

sha="${1:?usage: production-remote-rollback.sh sha}"
root="${PRODUCTION_CHECKOUT:-/opt/dinamic-clean}"
unset PRODUCTION_COMPOSE_FILE PRODUCTION_REGISTRY
file="${root}/deploy.env"
[[ -f "$file" ]] || { echo "PRODUCTION_ROLLBACK_REJECTED deploy_env" >&2; exit 2; }
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    PRODUCTION_COMPOSE_FILE|PRODUCTION_REGISTRY) export "$key=$value" ;;
    *) echo "PRODUCTION_ROLLBACK_REJECTED deploy_env_key" >&2; exit 2 ;;
  esac
done < "$file"
compose="${PRODUCTION_COMPOSE_FILE:?PRODUCTION_COMPOSE_FILE is required}"
marker="$root/releases/rolling-back"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "PRODUCTION_ROLLBACK_REJECTED sha" >&2; exit 2; }
[[ "$root" == /opt/dinamic-clean ]] || { echo "PRODUCTION_ROLLBACK_REJECTED checkout" >&2; exit 2; }
if [[ -f "$marker" ]]; then
  echo "PRODUCTION_ROLLBACK_REJECTED already_running" >&2
  exit 1
fi
printf '%s\n' "$sha" >"$marker"
trap 'rm -f "$marker"' EXIT

docker image inspect "dinamic-clean-api:production-${sha}" >/dev/null
cd "$root"
APP_RELEASE_SHA="$sha" docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api
curl -fsS --max-time 20 http://127.0.0.1:3005/healthz | grep -F "$sha" >/dev/null
curl -fsS --max-time 20 http://127.0.0.1:3005/readyz >/dev/null
printf '%s\n' "$sha" >"$root/releases/current-sha"
echo "PRODUCTION_ROLLBACK_CONFIRMED ${sha}"
