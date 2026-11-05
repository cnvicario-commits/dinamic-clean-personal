#!/usr/bin/env bash
# Recreate only the Cristian frontend. The API compose file is not used.
# Do not remove orphan containers. That flag can delete services outside this file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"${ROOT}/scripts/preflight-cristian-frontend.sh"
if ! docker network inspect dinamic-clean-cristian >/dev/null 2>&1; then
  echo "PREFLIGHT_REJECTED cristian_network_missing" >&2
  exit 1
fi
docker compose -f "${ROOT}/deploy/docker-compose.cristian-frontend.yml" up -d --no-deps --no-build --force-recreate frontend
