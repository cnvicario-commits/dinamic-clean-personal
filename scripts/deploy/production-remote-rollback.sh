#!/usr/bin/env bash
# Restore the previous production API image. SQL, Nginx, and Vercel stay as they are.
# A schema-incompatibility marker stops the restore and asks for a person.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/acquire-service-lock.sh"
# shellcheck disable=SC1091
source "$here/recreate-one.sh"

node "$here/path-boundary.mjs" expect-privileged "$here" >/dev/null
if [[ "${PRODUCTION_COMPOSE_REVIEWED:-}" != "operator-reviewed" ]]; then
  echo "PRODUCTION_ROLLBACK_REJECTED compose_not_reviewed" >&2
  exit 2
fi
compose="${PRODUCTION_COMPOSE_FILE:-/opt/dinamic-clean-privileged/compose/api.yml}"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  [[ "$compose" != "/opt/dinamic-clean-privileged/compose/api.yml" ]] || { echo "PRODUCTION_ROLLBACK_REJECTED disposable_path" >&2; exit 2; }
  export PRODUCTION_COMPOSE_MODE=disposable
fi
node "$here/path-boundary.mjs" expect-privileged "$compose" >/dev/null
node "$here/assess-production-compose.mjs" "$compose" >/dev/null
state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/production}"
if [[ -f "$state/schema-incompatible" || "${PRODUCTION_SCHEMA_INCOMPATIBLE:-}" == "1" ]]; then
  echo "PRODUCTION_ROLLBACK_REQUIRES_HUMAN schema" >&2
  exit 1
fi
acquire_service_lock "$state/production/api.flock" "$@"

restore="$(node "$here/release-state.mjs" rollback-plan "$state" production api)" || exit 1
read -r _marker restore_sha restore_digest restore_image <<<"$restore"
image_repo="dinamic-clean-api"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  image_repo="${DINAMIC_DISPOSABLE_IMAGE_PREFIX:-dinamic-crtest}-api"
fi
port="${PRODUCTION_API_HOST_PORT:-3005}"

fail_rollback() {
  local reason="$1"
  RELEASE_SHA="$restore_sha" RELEASE_DIGEST="$restore_digest" RELEASE_IMAGE="$restore_image" \
    RELEASE_RUN_ID="${RELEASE_RUN_ID:-1}" RELEASE_PHASE="rollback" RELEASE_REASON="$reason" \
    node "$here/release-state.mjs" fail "$state" production api >/dev/null
  echo "PRODUCTION_ROLLBACK_FAILED ${reason}" >&2
  exit 1
}

if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
  [[ "${FIXTURE_IMAGE:-ok}" == "ok" ]] || fail_rollback image_absent
  [[ "${FIXTURE_DIGEST:-ok}" == "ok" ]] || fail_rollback digest
  recreate_one "$compose" api "${image_repo}:${restore_sha}" "$restore_sha" || fail_rollback recreate
  export RELEASE_SHA="$restore_sha"
  node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${port}/healthz" || fail_rollback health
  node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${port}/readyz" || fail_rollback health
else
  docker image inspect "$restore_image" >/dev/null || fail_rollback image_absent
  if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
    actual_id="$(docker image inspect --format '{{.Id}}' "$restore_image")" || fail_rollback digest
    [[ "$actual_id" == "$restore_digest" ]] || fail_rollback digest
  else
    digests="$(docker image inspect --format '{{json .RepoDigests}}' "$restore_image")" || fail_rollback digest
    RELEASE_DIGEST="$restore_digest" RELEASE_ACTUAL="$digests" node "$here/release-state.mjs" digest "$state" production api >/dev/null || fail_rollback digest
  fi
  docker tag "$restore_image" "${image_repo}:${restore_sha}"
  recreate_one "$compose" api "${image_repo}:${restore_sha}" "$restore_sha" || fail_rollback recreate
  export RELEASE_SHA="$restore_sha"
  node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${port}/healthz" || fail_rollback health
  node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${port}/readyz" || fail_rollback health
fi

node "$here/release-state.mjs" rollback-commit "$state" production api >/dev/null
echo "PRODUCTION_ROLLBACK_CONFIRMED ${restore_sha}"
