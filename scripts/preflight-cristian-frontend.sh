#!/usr/bin/env bash
# Required before any command that creates or recreates the Cristian frontend.
# It does not build the image and it does not start the API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "PREFLIGHT_REJECTED missing-${name}" >&2
    exit 1
  fi
}

require CRISTIAN_NEXT_PUBLIC_SUPABASE_URL
require CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY
require CRISTIAN_NEXT_PUBLIC_API_URL
require CRISTIAN_FRONTEND_HOST_PORT
require CRISTIAN_FRONTEND_CPUS
require CRISTIAN_FRONTEND_MEMORY
require APP_RELEASE_SHA

if [[ -n "${APP_DEPLOYMENT_ENV:-}" && "$APP_DEPLOYMENT_ENV" != "cristian-pruebas" ]]; then
  echo "PREFLIGHT_REJECTED deployment-env" >&2
  exit 1
fi

if [[ "$CRISTIAN_FRONTEND_HOST_PORT" == "3005" || "$CRISTIAN_FRONTEND_HOST_PORT" == "3006" ]]; then
  echo "PREFLIGHT_REJECTED reserved_port" >&2
  exit 1
fi

if [[ -n "${CRISTIAN_API_HOST_PORT:-}" && "$CRISTIAN_FRONTEND_HOST_PORT" == "$CRISTIAN_API_HOST_PORT" ]]; then
  echo "PREFLIGHT_REJECTED shared_port" >&2
  exit 1
fi

if [[ "$CRISTIAN_NEXT_PUBLIC_API_URL" == "http://170.239.85.196:3006" && "$CRISTIAN_FRONTEND_HOST_PORT" != "8086" ]]; then
  echo "PREFLIGHT_REJECTED frontend_port" >&2
  exit 1
fi

if [[ ! "$CRISTIAN_FRONTEND_HOST_PORT" =~ ^[0-9]+$ ]] || (( CRISTIAN_FRONTEND_HOST_PORT < 1024 || CRISTIAN_FRONTEND_HOST_PORT > 65535 )); then
  echo "PREFLIGHT_REJECTED invalid_port" >&2
  exit 1
fi

export APP_DEPLOYMENT_ENV=cristian-pruebas
export NEXT_PUBLIC_SUPABASE_URL="$CRISTIAN_NEXT_PUBLIC_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY"
export NEXT_PUBLIC_API_URL="$CRISTIAN_NEXT_PUBLIC_API_URL"
node "${ROOT}/scripts/assert-cristian-frontend-env.mjs" deploy >/dev/null

rendered="$(
  docker compose -f "${ROOT}/deploy/docker-compose.cristian-frontend.yml" config
)"

printf '%s\n' "$rendered" | python3 "${ROOT}/scripts/assert-cristian-frontend-compose-render.py" \
  "$CRISTIAN_FRONTEND_HOST_PORT" "$APP_RELEASE_SHA"

echo "frontend_preflight_ok"
