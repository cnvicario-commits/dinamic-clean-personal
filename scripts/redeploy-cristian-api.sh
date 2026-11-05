#!/usr/bin/env bash
# Recreate only the Cristian API. The preflight runs first and can abort this script.
# It does not copy .env, certificates, or any production Compose file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"${ROOT}/scripts/preflight-cristian-deploy.sh"
docker compose -f "${ROOT}/deploy/docker-compose.cristian.yml" up -d --no-deps --force-recreate api
