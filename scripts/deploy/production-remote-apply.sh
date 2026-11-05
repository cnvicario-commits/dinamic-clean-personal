#!/usr/bin/env bash
# Production API update. Merge does not run this. The workflow stays off
# until PRODUCTION_DEPLOY_ENABLED is set, and this script still requires a
# reviewed Compose file. It does not change Nginx, Vercel, or the database.
set -euo pipefail

sha="${1:?sha}"
digest="${2:?digest}"
run_id="${3:?run-id}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/acquire-service-lock.sh"
# shellcheck disable=SC1091
source "$here/recreate-one.sh"

node "$here/path-boundary.mjs" expect-privileged "$here" >/dev/null
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED sha" >&2; exit 2; }
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED digest" >&2; exit 2; }
[[ "$run_id" =~ ^[1-9][0-9]*$ ]] || { echo "PRODUCTION_DEPLOY_REJECTED run_id" >&2; exit 2; }
if [[ "${PRODUCTION_COMPOSE_REVIEWED:-}" != "operator-reviewed" ]]; then
  echo "PRODUCTION_DEPLOY_REJECTED compose_not_reviewed" >&2
  exit 2
fi

compose="${PRODUCTION_COMPOSE_FILE:-/opt/dinamic-clean-privileged/compose/api.yml}"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  [[ "$compose" != "/opt/dinamic-clean-privileged/compose/api.yml" ]] || { echo "PRODUCTION_DEPLOY_REJECTED disposable_path" >&2; exit 2; }
  export PRODUCTION_COMPOSE_MODE=disposable
fi
node "$here/path-boundary.mjs" expect-privileged "$compose" >/dev/null
export RELEASE_SHA="$sha" RELEASE_DIGEST="$digest" RELEASE_RUN_ID="$run_id" RELEASE_RUN_ATTEMPT="${RELEASE_RUN_ATTEMPT:-1}"
registry="${PRODUCTION_REGISTRY:-ghcr.io/example}"
image_repo="dinamic-clean-api"
pull_ref="${registry}/dinamic-clean-api@${digest}"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  image_repo="${DINAMIC_DISPOSABLE_IMAGE_PREFIX:-dinamic-crtest}-api"
  pull_ref="${image_repo}:${sha}"
fi
export RELEASE_IMAGE="$pull_ref"
node "$here/assess-production-compose.mjs" "$compose" >/dev/null

state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/production}"
acquire_service_lock "$state/production/api.flock" "$@"
plan="$(node "$here/release-state.mjs" plan "$state" production api)" || exit 1
printf '%s\n' "$plan"
if [[ "$plan" == "RELEASE_IDEMPOTENT" ]]; then
  echo "PRODUCTION_DEPLOY_CONFIRMED idempotent ${sha}"
  exit 0
fi

port="${PRODUCTION_API_HOST_PORT:-3005}"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" && ( "$port" == "3005" || "$port" == "3006" || "$port" == "8086" ) ]]; then
  echo "PRODUCTION_DEPLOY_REJECTED disposable_port" >&2
  exit 2
fi

finish_failure() {
  local phase="$1" reason="$2"
  RELEASE_PHASE="$phase" RELEASE_REASON="$reason" node "$here/release-state.mjs" fail "$state" production api >/dev/null
  if [[ "$reason" == "schema_incompatible" || -f "$state/schema-incompatible" ]]; then
    echo "PRODUCTION_ROLLBACK_REQUIRES_HUMAN schema" >&2
    exit 1
  fi
  if [[ "$phase" == "before_recreate" ]]; then
    echo "PRODUCTION_DEPLOY_FAILED_BEFORE_RECREATE ${reason}" >&2
    exit 1
  fi
  local restore
  if ! restore="$(node "$here/release-state.mjs" recover "$state" production api)"; then
    echo "PRODUCTION_ROLLBACK_UNAVAILABLE" >&2
    exit 1
  fi
  local _marker restore_sha restore_digest restore_image
  read -r _marker restore_sha restore_digest restore_image <<<"$restore"
  if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
    [[ "${FIXTURE_RESTORE:-ok}" == "ok" ]] || { echo "PRODUCTION_ROLLBACK_FAILED" >&2; exit 1; }
  else
    docker image inspect "$restore_image" >/dev/null || { echo "PRODUCTION_ROLLBACK_FAILED image_absent" >&2; exit 1; }
    if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
      local actual_id
      actual_id="$(docker image inspect --format '{{.Id}}' "$restore_image")" || { echo "PRODUCTION_ROLLBACK_FAILED digest" >&2; exit 1; }
      [[ "$actual_id" == "$restore_digest" ]] || { echo "PRODUCTION_ROLLBACK_FAILED digest" >&2; exit 1; }
    else
      local digests
      digests="$(docker image inspect --format '{{json .RepoDigests}}' "$restore_image")" || { echo "PRODUCTION_ROLLBACK_FAILED digest" >&2; exit 1; }
      RELEASE_DIGEST="$restore_digest" RELEASE_ACTUAL="$digests" node "$here/release-state.mjs" digest "$state" production api >/dev/null || { echo "PRODUCTION_ROLLBACK_FAILED digest" >&2; exit 1; }
    fi
    docker tag "$restore_image" "${image_repo}:${restore_sha}"
    recreate_one "$compose" api "${image_repo}:${restore_sha}" "$restore_sha" || { echo "PRODUCTION_ROLLBACK_FAILED recreate" >&2; exit 1; }
    RELEASE_SHA="$restore_sha" node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${port}/healthz" || { echo "PRODUCTION_ROLLBACK_FAILED health" >&2; exit 1; }
    RELEASE_SHA="$restore_sha" node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${port}/readyz" || { echo "PRODUCTION_ROLLBACK_FAILED health" >&2; exit 1; }
  fi
  echo "PRODUCTION_ROLLBACK_CONFIRMED ${restore_sha}" >&2
  exit 1
}

if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
  [[ "${FIXTURE_PULL:-ok}" == "ok" ]] || finish_failure before_recreate image_absent
  recreate_one "$compose" api "${image_repo}:${sha}" "$sha" || finish_failure after_recreate recreate
elif [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  docker image inspect "${image_repo}:${sha}" >/dev/null || finish_failure before_recreate image_absent
  actual_id="$(docker image inspect --format '{{.Id}}' "${image_repo}:${sha}")" || finish_failure before_recreate digest
  [[ "$actual_id" == "$digest" ]] || finish_failure before_recreate digest
  recreate_one "$compose" api "${image_repo}:${sha}" "$sha" || finish_failure after_recreate recreate
else
  docker pull "$pull_ref" || finish_failure before_recreate image_absent
  digests="$(docker image inspect --format '{{json .RepoDigests}}' "$pull_ref")" || finish_failure before_recreate digest
  RELEASE_ACTUAL="$digests" node "$here/release-state.mjs" digest "$state" production api >/dev/null || finish_failure before_recreate digest
  docker tag "$pull_ref" "${image_repo}:${sha}"
  recreate_one "$compose" api "${image_repo}:${sha}" "$sha" || finish_failure after_recreate recreate
fi

probe_err=""
if ! probe_err="$(RELEASE_SHA="$sha" node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${port}/healthz" 2>&1)"; then
  printf '%s\n' "$probe_err" >&2
  finish_failure after_recreate health
fi
if ! probe_err="$(RELEASE_SHA="$sha" node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${port}/readyz" 2>&1)"; then
  printf '%s\n' "$probe_err" >&2
  if [[ "$probe_err" == *schema_incompatible* ]]; then
    finish_failure after_recreate schema_incompatible
  fi
  finish_failure after_recreate readyz
fi
node "$here/release-state.mjs" commit "$state" production api >/dev/null
echo "PRODUCTION_DEPLOY_CONFIRMED ${sha}"
