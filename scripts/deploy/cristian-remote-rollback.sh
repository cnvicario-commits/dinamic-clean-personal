#!/usr/bin/env bash
# Restore the previously recorded Cristian image. One attempt only.
set -euo pipefail

service="${1:?usage: cristian-remote-rollback.sh api|frontend|both sha}"
sha="${2:?usage: cristian-remote-rollback.sh api|frontend|both sha}"
root="${CRISTIAN_CHECKOUT:-/opt/dinamic-clean-cristian}"
[[ "$root" == /opt/dinamic-clean-cristian ]] || { echo "ROLLBACK_REJECTED checkout" >&2; exit 2; }
# shellcheck disable=SC1091
source "$(dirname "${BASH_SOURCE[0]}")/load-cristian-deploy-env.sh"
marker="$root/releases/rolling-back"

case "$service" in
  api|frontend|both) ;;
  *) echo "ROLLBACK_REJECTED service" >&2; exit 2 ;;
esac
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "ROLLBACK_REJECTED sha" >&2; exit 2; }
if [[ -f "$marker" ]]; then
  echo "ROLLBACK_REJECTED already_running" >&2
  exit 1
fi
printf '%s\n' "$sha" >"$marker"
trap 'rm -f "$marker"' EXIT

export APP_RELEASE_SHA="$sha"
export CRISTIAN_NO_BUILD=1
cd "$root"
if [[ "$service" == "api" || "$service" == "both" ]]; then
  docker image inspect "dinamic-clean-api:${sha}" >/dev/null
  ./scripts/redeploy-cristian-api.sh
  curl -fsS --max-time 20 "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/healthz" | grep -F "$sha" >/dev/null
  curl -fsS --max-time 20 "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/readyz" >/dev/null
fi
if [[ "$service" == "frontend" || "$service" == "both" ]]; then
  docker image inspect "dinamic-clean-frontend:${sha}" >/dev/null
  ./scripts/redeploy-cristian-frontend.sh
  curl -fsS --max-time 20 "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/api/healthz" | grep -F "$sha" >/dev/null
fi
printf '%s\n' "$sha" >"$root/releases/current-sha"
printf '%s\n' "$service" >"$root/releases/current-service"
echo "ROLLBACK_CONFIRMED ${service} ${sha}"
