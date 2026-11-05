#!/usr/bin/env bash
# Apply one already-built Cristian release on the VPS.
# This script is not installed or executed by the Phase 4 implementation.
set -euo pipefail

service="${1:?usage: cristian-remote-apply.sh api|frontend|both sha}"
sha="${2:?usage: cristian-remote-apply.sh api|frontend|both sha}"
root="${CRISTIAN_CHECKOUT:-/opt/dinamic-clean-cristian}"
[[ "$root" == /opt/dinamic-clean-cristian ]] || { echo "DEPLOY_REJECTED checkout" >&2; exit 2; }
# shellcheck disable=SC1091
source "$(dirname "${BASH_SOURCE[0]}")/load-cristian-deploy-env.sh"
registry="${CRISTIAN_REGISTRY:?CRISTIAN_REGISTRY is required}"
api_image="${registry}/dinamic-clean-api:cristian-${sha}"
frontend_image="${registry}/dinamic-clean-frontend:cristian-${sha}"

case "$service" in
  api|frontend|both) ;;
  *) echo "DEPLOY_REJECTED service" >&2; exit 2 ;;
esac
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "DEPLOY_REJECTED sha" >&2; exit 2; }
[[ "$registry" == ghcr.io/* && "$registry" != *latest* ]] || { echo "DEPLOY_REJECTED registry" >&2; exit 2; }
[[ "$root" != /opt/dinamic-clean && "$root" != /opt/dinamic-clean/* ]] || { echo "DEPLOY_REJECTED production_path" >&2; exit 2; }

cd "$root"
mkdir -p "$root/releases"
exec 9>"$root/releases/deploy.lock"
if ! flock -n 9; then
  echo "DEPLOY_REJECTED locked" >&2
  exit 1
fi
if [[ -f "$root/releases/rolling-back" ]]; then
  echo "DEPLOY_REJECTED rollback_in_progress" >&2
  exit 1
fi

previous="$(cat "$root/releases/current-sha" 2>/dev/null || true)"
previous_service="$(cat "$root/releases/current-service" 2>/dev/null || true)"
printf '%s\n' "$previous" >"$root/releases/previous-sha"
printf '%s\n' "$previous_service" >"$root/releases/previous-service"

pull_and_tag() {
  local remote="$1" local_name="$2"
  docker pull "$remote"
  docker tag "$remote" "$local_name"
}

if [[ "$service" == "api" || "$service" == "both" ]]; then
  pull_and_tag "$api_image" "dinamic-clean-api:${sha}"
fi
if [[ "$service" == "frontend" || "$service" == "both" ]]; then
  pull_and_tag "$frontend_image" "dinamic-clean-frontend:${sha}"
fi

export APP_RELEASE_SHA="$sha"
export CRISTIAN_NO_BUILD=1
failed=0
if [[ "$service" == "api" || "$service" == "both" ]]; then
  ./scripts/redeploy-cristian-api.sh || failed=1
fi
if [[ "$failed" == "0" && ( "$service" == "frontend" || "$service" == "both" ) ]]; then
  ./scripts/redeploy-cristian-frontend.sh || failed=1
fi

check_url() {
  local url="$1" expected="$2"
  local body
  body="$(curl -fsS --max-time 20 "$url")" || return 1
  [[ "$body" == *"$expected"* ]]
}

if [[ "$failed" == "0" && ( "$service" == "api" || "$service" == "both" ) ]]; then
  check_url "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/healthz" "$sha" || failed=1
  check_url "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/readyz" '"status":"ok"' || failed=1
fi
if [[ "$failed" == "0" && ( "$service" == "frontend" || "$service" == "both" ) ]]; then
  check_url "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/api/healthz" "$sha" || failed=1
  curl -fsS --max-time 20 -o /dev/null "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/login" || failed=1
fi

if [[ "$failed" != "0" ]]; then
  echo "DEPLOY_HEALTH_FAILED ${service} ${sha}" >&2
  if [[ -n "$previous" ]]; then
    CRISTIAN_REGISTRY="$registry" "$root/scripts/deploy/cristian-remote-rollback.sh" "$previous_service" "$previous" || {
      echo "ROLLBACK_FAILED" >&2
      exit 1
    }
  fi
  exit 1
fi

printf '%s\n' "$sha" >"$root/releases/current-sha"
printf '%s\n' "$service" >"$root/releases/current-service"
echo "DEPLOY_CONFIRMED ${service} ${sha}"

production_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3005/healthz || echo curl_failed)"
echo "PRODUCTION_PORT_3005 ${production_code}"
if [[ "$production_code" != "200" ]]; then
  echo "PRODUCTION_CHECK_FAILED" >&2
  exit 1
fi
