#!/usr/bin/env bash
# Restore one Cristian service. The release record changes only after that
# container is healthy on the restored release.
set -euo pipefail

service="${1:?usage: cristian-remote-rollback.sh api|frontend}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/acquire-service-lock.sh"
# shellcheck disable=SC1091
source "$here/recreate-one.sh"

node "$here/path-boundary.mjs" expect-privileged "$here" >/dev/null
case "$service" in
  api|frontend) ;;
  *) echo "ROLLBACK_REJECTED service" >&2; exit 2 ;;
esac
state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/cristian}"
acquire_service_lock "$state/cristian/${service}.flock" "$@"

restore="$(node "$here/release-state.mjs" rollback-plan "$state" cristian "$service")" || exit 1
read -r _marker restore_sha restore_digest restore_image <<<"$restore"
[[ "$restore_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "ROLLBACK_REJECTED sha" >&2; exit 1; }
[[ "$restore_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "ROLLBACK_REJECTED digest" >&2; exit 1; }

image_repo="dinamic-clean-${service}"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  image_repo="${DINAMIC_DISPOSABLE_IMAGE_PREFIX:-dinamic-crtest}-${service}"
  disposable_port="${CRISTIAN_API_HOST_PORT:-}"
  if [[ "$service" == "frontend" ]]; then disposable_port="${CRISTIAN_FRONTEND_HOST_PORT:-}"; fi
  [[ -n "$disposable_port" && "$disposable_port" != "3005" && "$disposable_port" != "3006" && "$disposable_port" != "8086" ]] || { echo "ROLLBACK_REJECTED disposable_port" >&2; exit 2; }
fi
compose="${DINAMIC_COMPOSE_FILE:-}"
if [[ -z "$compose" ]]; then
  root="${DINAMIC_PRIVILEGED_ROOT:-/opt/dinamic-clean-privileged}"
  if [[ "$service" == "api" ]]; then
    compose="$root/compose/docker-compose.cristian.yml"
  else
    compose="$root/compose/docker-compose.cristian-frontend.yml"
  fi
fi

fail_rollback() {
  local reason="$1"
  RELEASE_SHA="$restore_sha" RELEASE_DIGEST="$restore_digest" RELEASE_IMAGE="$restore_image" \
    RELEASE_RUN_ID="${RELEASE_RUN_ID:-1}" RELEASE_PHASE="rollback" RELEASE_REASON="$reason" \
    node "$here/release-state.mjs" fail "$state" cristian "$service" >/dev/null
  echo "ROLLBACK_FAILED ${service} ${reason}" >&2
  exit 1
}

if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
  [[ "${FIXTURE_IMAGE:-ok}" == "ok" ]] || fail_rollback image_absent
  [[ "${FIXTURE_DIGEST:-ok}" == "ok" ]] || fail_rollback digest
  recreate_one "$compose" "$service" "${image_repo}:${restore_sha}" "$restore_sha" || fail_rollback recreate
  export RELEASE_SHA="$restore_sha"
  if [[ "$service" == "api" ]]; then
    node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/healthz" || fail_rollback health
    node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/readyz" || fail_rollback health
  else
    node "$here/assess-health.mjs" frontend-healthz "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/api/healthz" || fail_rollback health
  fi
else
  docker image inspect "$restore_image" >/dev/null || fail_rollback image_absent
  if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
    actual_id="$(docker image inspect --format '{{.Id}}' "$restore_image")" || fail_rollback digest
    [[ "$actual_id" == "$restore_digest" ]] || fail_rollback digest
  else
    digests="$(docker image inspect --format '{{json .RepoDigests}}' "$restore_image")" || fail_rollback digest
    RELEASE_DIGEST="$restore_digest" RELEASE_ACTUAL="$digests" node "$here/release-state.mjs" digest "$state" cristian "$service" >/dev/null || fail_rollback digest
  fi
  docker tag "$restore_image" "${image_repo}:${restore_sha}"
  recreate_one "$compose" "$service" "${image_repo}:${restore_sha}" "$restore_sha" || fail_rollback recreate
  export RELEASE_SHA="$restore_sha"
  if [[ "$service" == "api" ]]; then
    node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/healthz" || fail_rollback health
    node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/readyz" || fail_rollback health
  else
    node "$here/assess-health.mjs" frontend-healthz "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/api/healthz" || fail_rollback health
    curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/login" || fail_rollback health
  fi
fi

node "$here/release-state.mjs" rollback-commit "$state" cristian "$service" >/dev/null
echo "ROLLBACK_CONFIRMED ${service} ${restore_sha} ${restore_digest}"
