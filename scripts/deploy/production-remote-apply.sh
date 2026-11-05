#!/usr/bin/env bash
# Prepared production API update. It is not installed or executed in Phase 4.
# It does not change Nginx, firewall, DNS, or the database.
set -euo pipefail

sha="${1:?usage: production-remote-apply.sh sha}"
root="${PRODUCTION_CHECKOUT:-/opt/dinamic-clean}"
unset PRODUCTION_COMPOSE_FILE PRODUCTION_REGISTRY
file="${root}/deploy.env"
[[ -f "$file" ]] || { echo "PRODUCTION_DEPLOY_REJECTED deploy_env" >&2; exit 2; }
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    PRODUCTION_COMPOSE_FILE|PRODUCTION_REGISTRY) export "$key=$value" ;;
    *) echo "PRODUCTION_DEPLOY_REJECTED deploy_env_key" >&2; exit 2 ;;
  esac
done < "$file"
compose="${PRODUCTION_COMPOSE_FILE:?PRODUCTION_COMPOSE_FILE is required}"
registry="${PRODUCTION_REGISTRY:?PRODUCTION_REGISTRY is required}"
image="${registry}/dinamic-clean-api:production-${sha}"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED sha" >&2; exit 2; }
[[ "$root" == /opt/dinamic-clean ]] || { echo "PRODUCTION_DEPLOY_REJECTED checkout" >&2; exit 2; }
[[ "$registry" == ghcr.io/* && "$registry" != *latest* ]] || { echo "PRODUCTION_DEPLOY_REJECTED registry" >&2; exit 2; }
[[ "$compose" == "$root"/* ]] || { echo "PRODUCTION_DEPLOY_REJECTED compose_path" >&2; exit 2; }
[[ -f "$compose" ]] || { echo "PRODUCTION_DEPLOY_REJECTED compose_missing" >&2; exit 2; }

if grep -E 'cristian-pruebas|edruejzwwnixsjsadbgb|3006|8086' "$compose" >/dev/null; then
  echo "PRODUCTION_DEPLOY_REJECTED cristian_config" >&2
  exit 2
fi
if ! grep -E '3005' "$compose" >/dev/null; then
  echo "PRODUCTION_DEPLOY_REJECTED port" >&2
  exit 2
fi

cd "$root"
mkdir -p "$root/releases"
exec 9>"$root/releases/deploy.lock"
flock -n 9 || { echo "PRODUCTION_DEPLOY_REJECTED locked" >&2; exit 1; }

previous="$(cat "$root/releases/current-sha" 2>/dev/null || true)"
printf '%s\n' "$previous" >"$root/releases/previous-sha"
docker pull "$image"
docker tag "$image" "dinamic-clean-api:production-${sha}"
APP_RELEASE_SHA="$sha" docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api

body="$(curl -fsS --max-time 20 http://127.0.0.1:3005/healthz)" || {
  echo "PRODUCTION_HEALTH_FAILED" >&2
  if [[ -n "$previous" ]]; then
    "$root/scripts/deploy/production-remote-rollback.sh" "$previous" || echo "PRODUCTION_ROLLBACK_FAILED" >&2
  fi
  exit 1
}
[[ "$body" == *"$sha"* ]] || { echo "PRODUCTION_HEALTH_FAILED sha" >&2; exit 1; }
curl -fsS --max-time 20 http://127.0.0.1:3005/readyz >/dev/null || { echo "PRODUCTION_READY_FAILED" >&2; exit 1; }
printf '%s\n' "$sha" >"$root/releases/current-sha"
echo "PRODUCTION_DEPLOY_CONFIRMED ${sha}"
