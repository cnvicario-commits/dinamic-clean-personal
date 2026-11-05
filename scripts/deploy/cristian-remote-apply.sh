#!/usr/bin/env bash
# Apply one Cristian service from an immutable image.
# The record changes only after the recreated container reports that release.
set -euo pipefail

service="${1:?usage: cristian-remote-apply.sh api|frontend sha digest run-id}"
sha="${2:?sha}"
digest="${3:?digest}"
run_id="${4:?run-id}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/acquire-service-lock.sh"
# shellcheck disable=SC1091
source "$here/recreate-one.sh"

node "$here/path-boundary.mjs" expect-privileged "$here" >/dev/null
case "$service" in
  api|frontend) ;;
  *) echo "DEPLOY_REJECTED service" >&2; exit 2 ;;
esac
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "DEPLOY_REJECTED sha" >&2; exit 2; }
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "DEPLOY_REJECTED digest" >&2; exit 2; }
[[ "$run_id" =~ ^[1-9][0-9]*$ ]] || { echo "DEPLOY_REJECTED run_id" >&2; exit 2; }

state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/cristian}"
acquire_service_lock "$state/cristian/${service}.flock" "$@"

if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" != "1" && "${DINAMIC_DISPOSABLE_DOCKER:-}" != "1" ]]; then
  # shellcheck disable=SC1091
  source "$here/load-cristian-deploy-env.sh"
fi

registry="${CRISTIAN_REGISTRY:-ghcr.io/example}"
image_repo="dinamic-clean-${service}"
pull_ref="${registry}/dinamic-clean-${service}@${digest}"
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  image_repo="${DINAMIC_DISPOSABLE_IMAGE_PREFIX:-dinamic-crtest}-${service}"
  pull_ref="${image_repo}:${sha}"
  disposable_port="${CRISTIAN_API_HOST_PORT:-}"
  if [[ "$service" == "frontend" ]]; then disposable_port="${CRISTIAN_FRONTEND_HOST_PORT:-}"; fi
  [[ -n "$disposable_port" && "$disposable_port" != "3005" && "$disposable_port" != "3006" && "$disposable_port" != "8086" ]] || { echo "DEPLOY_REJECTED disposable_port" >&2; exit 2; }
fi
export RELEASE_SHA="$sha" RELEASE_DIGEST="$digest" RELEASE_RUN_ID="$run_id"
export RELEASE_RUN_ATTEMPT="${RELEASE_RUN_ATTEMPT:-1}" RELEASE_IMAGE="$pull_ref"

plan="$(node "$here/release-state.mjs" plan "$state" cristian "$service")" || exit 1
printf '%s\n' "$plan"
if [[ "$plan" == "RELEASE_IDEMPOTENT" ]]; then
  echo "DEPLOY_CONFIRMED idempotent ${service} ${sha}"
  exit 0
fi

compose_for() {
  if [[ -n "${DINAMIC_COMPOSE_FILE:-}" ]]; then
    printf '%s\n' "$DINAMIC_COMPOSE_FILE"
    return
  fi
  local root="${DINAMIC_PRIVILEGED_ROOT:-/opt/dinamic-clean-privileged}"
  if [[ "$service" == "api" ]]; then
    printf '%s\n' "$root/compose/docker-compose.cristian.yml"
  else
    printf '%s\n' "$root/compose/docker-compose.cristian-frontend.yml"
  fi
}

probe_service() {
  local release_sha="$1"
  RELEASE_SHA="$release_sha"
  export RELEASE_SHA
  if [[ "$service" == "api" ]]; then
    node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/healthz" || return 1
    node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/readyz" || return 1
  else
    node "$here/assess-health.mjs" frontend-healthz "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/api/healthz" || return 1
    if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
      [[ "${FIXTURE_LOGIN_HTTP:-200}" == "200" ]] || return 1
    else
      curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/login" || return 1
    fi
  fi
}

finish_failure() {
  local phase="$1" reason="$2"
  RELEASE_PHASE="$phase" RELEASE_REASON="$reason" node "$here/release-state.mjs" fail "$state" cristian "$service" >/dev/null
  if [[ "$phase" == "before_recreate" ]]; then
    echo "DEPLOY_FAILED_BEFORE_RECREATE ${service} ${reason}" >&2
    exit 1
  fi
  local restore
  if ! restore="$(node "$here/release-state.mjs" recover "$state" cristian "$service")"; then
    echo "ROLLBACK_UNAVAILABLE ${service}" >&2
    exit 1
  fi
  local _marker restore_sha restore_digest restore_image
  read -r _marker restore_sha restore_digest restore_image <<<"$restore"
  if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
    if [[ "${FIXTURE_RESTORE:-ok}" != "ok" ]]; then
      echo "ROLLBACK_FAILED ${service}" >&2
      exit 1
    fi
    if [[ -n "${FIXTURE_RECREATE_LOG:-}" ]]; then
      printf '%s\n' "$service" >> "$FIXTURE_RECREATE_LOG"
    fi
  else
    docker image inspect "$restore_image" >/dev/null || { echo "ROLLBACK_FAILED ${service} image_absent" >&2; exit 1; }
    if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
      local actual_id
      actual_id="$(docker image inspect --format '{{.Id}}' "$restore_image")" || { echo "ROLLBACK_FAILED ${service} digest" >&2; exit 1; }
      [[ "$actual_id" == "$restore_digest" ]] || { echo "ROLLBACK_FAILED ${service} digest" >&2; exit 1; }
      docker tag "$restore_image" "${image_repo}:${restore_sha}"
    else
      local digests
      digests="$(docker image inspect --format '{{json .RepoDigests}}' "$restore_image")" || { echo "ROLLBACK_FAILED ${service} digest" >&2; exit 1; }
      RELEASE_DIGEST="$restore_digest" RELEASE_ACTUAL="$digests" node "$here/release-state.mjs" digest "$state" cristian "$service" >/dev/null || { echo "ROLLBACK_FAILED ${service} digest" >&2; exit 1; }
      docker tag "$restore_image" "${image_repo}:${restore_sha}"
    fi
    local compose
    compose="$(compose_for)"
    recreate_one "$compose" "$service" "${image_repo}:${restore_sha}" "$restore_sha" || { echo "ROLLBACK_FAILED ${service}" >&2; exit 1; }
    probe_service "$restore_sha" || { echo "ROLLBACK_FAILED ${service} health" >&2; exit 1; }
  fi
  echo "ROLLBACK_CONFIRMED ${service} ${restore_sha}" >&2
  exit 1
}

prepare_image() {
  if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
    [[ "${FIXTURE_PULL:-ok}" == "ok" ]] || finish_failure before_recreate image_absent
    return
  fi
  if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
    docker image inspect "${image_repo}:${sha}" >/dev/null || finish_failure before_recreate image_absent
    local actual_id
    actual_id="$(docker image inspect --format '{{.Id}}' "${image_repo}:${sha}")" || finish_failure before_recreate digest
    [[ "$actual_id" == "$digest" ]] || finish_failure before_recreate digest
    return
  fi
  docker pull "$pull_ref" || finish_failure before_recreate image_absent
  local digests
  digests="$(docker image inspect --format '{{json .RepoDigests}}' "$pull_ref")" || finish_failure before_recreate digest
  RELEASE_ACTUAL="$digests" node "$here/release-state.mjs" digest "$state" cristian "$service" >/dev/null || finish_failure before_recreate digest
  docker tag "$pull_ref" "${image_repo}:${sha}"
}

prepare_image
compose="$(compose_for)"
recreate_one "$compose" "$service" "${image_repo}:${sha}" "$sha" || finish_failure after_recreate recreate
probe_service "$sha" || finish_failure after_recreate health
node "$here/release-state.mjs" commit "$state" cristian "$service" >/dev/null
echo "DEPLOY_CONFIRMED ${service} ${sha}"
