#!/usr/bin/env bash
# Production API update. It does not run unless the Compose copy was reviewed.
# It does not change Nginx, firewall, DNS, or the database.
set -euo pipefail

sha="${1:?sha}"
digest="${2:?digest}"
run_id="${3:?run-id}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$here/path-boundary.mjs" "$here" >/dev/null
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED sha" >&2; exit 2; }
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED digest" >&2; exit 2; }
[[ "$run_id" =~ ^[1-9][0-9]*$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED run_id" >&2; exit 2; }
if [[ "${PRODUCTION_COMPOSE_REVIEWED:-}" != "operator-reviewed" ]]; then
  echo "PRODUCTION_DEPLOY_REJECTED compose_not_reviewed" >&2
  exit 2
fi

compose="${PRODUCTION_COMPOSE_FILE:-/opt/dinamic-clean-privileged/compose/api.yml}"
registry="${PRODUCTION_REGISTRY:-ghcr.io/example}"
export RELEASE_SHA="$sha" RELEASE_DIGEST="$digest" RELEASE_RUN_ID="$run_id" RELEASE_RUN_ATTEMPT="${RELEASE_RUN_ATTEMPT:-1}"
export RELEASE_IMAGE="${registry}/dinamic-clean-api@${digest}"
node "$here/assess-production-compose.mjs" "$compose" >/dev/null
state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/production}"
plan="$(node "$here/release-state.mjs" plan "$state" production api)" || exit 1
if [[ "$plan" == "RELEASE_IDEMPOTENT" ]]; then
  echo "PRODUCTION_DEPLOY_CONFIRMED idempotent ${sha}"
  exit 0
fi
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" != "1" ]]; then
  echo "PRODUCTION_DEPLOY_REJECTED remote_execution_not_enabled" >&2
  exit 2
fi
node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:3005/healthz"
node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:3005/readyz"
node "$here/release-state.mjs" commit "$state" production api >/dev/null
echo "PRODUCTION_DEPLOY_CONFIRMED ${sha}"
