#!/usr/bin/env bash
# Required before any command that recreates the Cristian API container.
# docker compose config is not a substitute for this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "PREFLIGHT_REJECTED missing-${name}" >&2
    exit 1
  fi
}

require CRISTIAN_SUPABASE_CA_FILE
require CRISTIAN_API_HOST_PORT
require CRISTIAN_API_CPUS
require CRISTIAN_API_MEMORY
require APP_RELEASE_SHA
require CRISTIAN_ENV_FILE

if [[ "${NODE_TLS_REJECT_UNAUTHORIZED:-}" == "0" ]]; then
  echo "PREFLIGHT_REJECTED tls_verification_disabled" >&2
  exit 1
fi

if [[ "$CRISTIAN_API_HOST_PORT" == "3005" ]]; then
  echo "PREFLIGHT_REJECTED production_port" >&2
  exit 1
fi

if [[ "$CRISTIAN_API_HOST_PORT" != "3006" ]]; then
  echo "PREFLIGHT_REJECTED api_port" >&2
  exit 1
fi

if [[ ! "$APP_RELEASE_SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "PREFLIGHT_REJECTED release-sha" >&2
  exit 1
fi

if [[ ! "$CRISTIAN_API_HOST_PORT" =~ ^[0-9]+$ ]] || (( CRISTIAN_API_HOST_PORT < 1024 || CRISTIAN_API_HOST_PORT > 65535 )); then
  echo "PREFLIGHT_REJECTED invalid_port" >&2
  exit 1
fi

case "$CRISTIAN_ENV_FILE" in
  /opt/dinamic-clean|/opt/dinamic-clean/*)
    echo "PREFLIGHT_REJECTED production-env" >&2
    exit 1
    ;;
esac

if [[ ! -f "$CRISTIAN_ENV_FILE" ]]; then
  echo "PREFLIGHT_REJECTED env-file-not-found" >&2
  exit 1
fi

if grep -E '^[[:space:]]*NODE_TLS_REJECT_UNAUTHORIZED[[:space:]]*=[[:space:]]*0([[:space:]]|$)' "$CRISTIAN_ENV_FILE" >/dev/null; then
  echo "PREFLIGHT_REJECTED tls_verification_disabled" >&2
  exit 1
fi

if grep -q 'biectbcujabpjhinouil' "$CRISTIAN_ENV_FILE"; then
  echo "PREFLIGHT_REJECTED production_ref" >&2
  exit 1
fi

cors="$(grep -E '^[[:space:]]*CORS_ORIGIN=' "$CRISTIAN_ENV_FILE" | head -n 1 || true)"
cors="${cors#*=}"
cors="${cors%%#*}"
cors="$(printf '%s' "$cors" | tr -d '[:space:]')"
if [[ "$cors" == "*" || "$cors" == *'*'* ]]; then
  echo "PREFLIGHT_REJECTED cors_wildcard" >&2
  exit 1
fi
if [[ "$cors" != "http://170.239.85.196:8086" ]]; then
  echo "PREFLIGHT_REJECTED cors_origin" >&2
  exit 1
fi

node "${ROOT}/scripts/assert-cristian-ca-file.mjs" "$CRISTIAN_SUPABASE_CA_FILE"

rendered="$(
  docker compose -f "${ROOT}/deploy/docker-compose.cristian.yml" config
)"

printf '%s\n' "$rendered" | python3 "${ROOT}/scripts/assert-cristian-compose-render.py" \
  "$CRISTIAN_API_HOST_PORT" "$APP_RELEASE_SHA" "$CRISTIAN_SUPABASE_CA_FILE"

echo "preflight_ok"
