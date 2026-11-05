#!/usr/bin/env bash
# Apply one Cristian service from an immutable image digest.
# This file is the template installed under /opt/dinamic-clean-privileged.
# It refuses to run from either application checkout.
set -euo pipefail

service="${1:?usage: cristian-remote-apply.sh api|frontend sha digest run-id}"
sha="${2:?sha}"
digest="${3:?digest}"
run_id="${4:?run-id}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$here/path-boundary.mjs" "$here" >/dev/null

case "$service" in
  api|frontend) ;;
  *) echo "DEPLOY_REJECTED service" >&2; exit 2 ;;
esac
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "DEPLOY_REJECTED sha" >&2; exit 2; }
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "DEPLOY_REJECTED digest" >&2; exit 2; }
[[ "$run_id" =~ ^[1-9][0-9]*$ ]] || { echo "DEPLOY_REJECTED run_id" >&2; exit 2; }

state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/cristian}"
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" != "1" ]]; then
  # shellcheck disable=SC1091
  source "$here/load-cristian-deploy-env.sh"
fi
registry="${CRISTIAN_REGISTRY:-ghcr.io/example}"
pull_ref="${registry}/dinamic-clean-${service}@${digest}"
export RELEASE_SHA="$sha" RELEASE_DIGEST="$digest" RELEASE_RUN_ID="$run_id"
export RELEASE_RUN_ATTEMPT="${RELEASE_RUN_ATTEMPT:-1}" RELEASE_IMAGE="$pull_ref"

plan="$(node "$here/release-state.mjs" plan "$state" cristian "$service")" || exit 1
printf '%s\n' "$plan"
if [[ "$plan" == "RELEASE_IDEMPOTENT" ]]; then
  echo "DEPLOY_CONFIRMED idempotent ${service} ${sha}"
  exit 0
fi

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
  # RELEASE_RESTORE sha digest image
  local restore_sha restore_digest restore_image
  read -r _ restore_sha restore_digest restore_image <<<"$restore"
  if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
    if [[ "${FIXTURE_RESTORE:-ok}" != "ok" ]]; then
      echo "ROLLBACK_FAILED ${service}" >&2
      exit 1
    fi
  else
    docker image inspect "$restore_image" >/dev/null || { echo "ROLLBACK_FAILED ${service} image_absent" >&2; exit 1; }
    RELEASE_DIGEST="$restore_digest" RELEASE_ACTUAL="$(docker image inspect --format '{{json .RepoDigests}}' "$restore_image")" \
      node "$here/release-state.mjs" digest "$state" cristian "$service" >/dev/null || { echo "ROLLBACK_FAILED ${service} digest" >&2; exit 1; }
    docker tag "$restore_image" "dinamic-clean-${service}:${restore_sha}"
    APP_RELEASE_SHA="$restore_sha" CRISTIAN_NO_BUILD=1 recreate_"$service" || { echo "ROLLBACK_FAILED ${service}" >&2; exit 1; }
  fi
  echo "ROLLBACK_CONFIRMED ${service} ${restore_sha}" >&2
  exit 1
}

recreate_api() {
  local compose="${DINAMIC_PRIVILEGED_ROOT:-/opt/dinamic-clean-privileged}/compose/docker-compose.cristian.yml"
  node "$here/path-boundary.mjs" "$compose" >/dev/null
  docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api
}

recreate_frontend() {
  local compose="${DINAMIC_PRIVILEGED_ROOT:-/opt/dinamic-clean-privileged}/compose/docker-compose.cristian-frontend.yml"
  node "$here/path-boundary.mjs" "$compose" >/dev/null
  docker compose -f "$compose" up -d --no-deps --no-build --force-recreate frontend
}

if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" != "1" ]]; then
  docker pull "$pull_ref" || finish_failure before_recreate image_absent
  RELEASE_ACTUAL="$(docker image inspect --format '{{json .RepoDigests}}' "$pull_ref")"
  export RELEASE_ACTUAL
  node "$here/release-state.mjs" digest "$state" cristian "$service" >/dev/null || finish_failure before_recreate digest
  docker tag "$pull_ref" "dinamic-clean-${service}:${sha}"
  APP_RELEASE_SHA="$sha" CRISTIAN_NO_BUILD=1 recreate_"$service" || finish_failure after_recreate recreate
else
  if [[ "${FIXTURE_PULL:-ok}" != "ok" ]]; then
    finish_failure before_recreate image_absent
  fi
  if [[ "${FIXTURE_RECREATE:-ok}" != "ok" ]]; then
    finish_failure after_recreate recreate
  fi
fi

if [[ "$service" == "api" ]]; then
  node "$here/assess-health.mjs" api-healthz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/healthz" || finish_failure after_recreate healthz
  node "$here/assess-health.mjs" api-readyz "http://127.0.0.1:${CRISTIAN_API_HOST_PORT:-3006}/readyz" || finish_failure after_recreate readyz
else
  node "$here/assess-health.mjs" frontend-healthz "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/api/healthz" || finish_failure after_recreate healthz
  if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
    [[ "${FIXTURE_LOGIN_HTTP:-200}" == "200" ]] || finish_failure after_recreate login
  else
    curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:${CRISTIAN_FRONTEND_HOST_PORT:-8086}/login" || finish_failure after_recreate login
  fi
fi

node "$here/release-state.mjs" commit "$state" cristian "$service" >/dev/null
echo "DEPLOY_CONFIRMED ${service} ${sha}"
