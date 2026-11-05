#!/usr/bin/env bash
# Record a release that is already running. This script does not recreate a container.
set -euo pipefail

environment="${1:?usage: adopt-release.sh cristian|production api|frontend}"
service="${2:?service}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$here/acquire-service-lock.sh"

node "$here/path-boundary.mjs" expect-privileged "$here" >/dev/null
case "$environment" in
  cristian|production) ;;
  *) echo "ADOPT_REJECTED environment" >&2; exit 2 ;;
esac
case "$service" in
  api|frontend) ;;
  *) echo "ADOPT_REJECTED service" >&2; exit 2 ;;
esac
if [[ "$environment" == "production" && "$service" != "api" ]]; then
  echo "ADOPT_REJECTED service" >&2
  exit 2
fi
if [[ "${ADOPT_CONFIRM:-}" != "adopt-running" ]]; then
  echo "ADOPT_REJECTED confirm" >&2
  exit 2
fi
if [[ "$environment" == "production" && "${ADOPT_PRODUCTION_AUTHORIZED:-}" != "operator-authorized" ]]; then
  echo "ADOPT_REJECTED production_authorization" >&2
  exit 2
fi
if [[ ! "${ADOPT_RUN_ID:-}" =~ ^[1-9][0-9]*$ ]]; then
  echo "ADOPT_REJECTED run_id" >&2
  echo "ADOPT_MANUAL provide the CI run id that built this image" >&2
  exit 2
fi

if [[ "$environment" == "cristian" && "$service" == "api" ]]; then
  default_name="dinamic-clean-cristian-api"
  deployment_env="cristian-pruebas"
  default_port="3006"
  state_env="cristian"
elif [[ "$environment" == "cristian" ]]; then
  default_name="dinamic-clean-cristian-frontend"
  deployment_env="cristian-pruebas"
  default_port="8086"
  state_env="cristian"
else
  default_name="dinamic-clean-api"
  deployment_env="production"
  default_port="3005"
  state_env="production"
fi

container="$default_name"
port="$default_port"
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" || "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  container="${ADOPT_CONTAINER:-$default_name}"
  port="${ADOPT_PORT:-$default_port}"
fi
if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
  [[ "$container" == dinamic-crtest* ]] || { echo "ADOPT_REJECTED disposable_name" >&2; exit 2; }
  [[ "$port" != "3005" && "$port" != "3006" && "$port" != "8086" ]] || { echo "ADOPT_REJECTED disposable_port" >&2; exit 2; }
fi

state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/${state_env}}"
acquire_service_lock "$state/${state_env}/${service}.flock" "$@"
current="$(node "$here/release-state.mjs" show "$state" "$state_env" "$service")" || exit 1
[[ "$current" == "RELEASE_CURRENT none" ]] || { echo "ADOPT_REJECTED already_initialized" >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
  [[ -n "${FIXTURE_ADOPT_CONTAINER:-}" && -n "${FIXTURE_ADOPT_IMAGE:-}" ]] || { echo "ADOPT_REJECTED missing" >&2; exit 1; }
  cp "$FIXTURE_ADOPT_CONTAINER" "$work/container.json"
  cp "$FIXTURE_ADOPT_IMAGE" "$work/image.json"
else
  docker inspect "$container" > "$work/container.json" || { echo "ADOPT_REJECTED missing" >&2; echo "ADOPT_MANUAL container was not found" >&2; exit 1; }
  image_id="$(docker inspect --format '{{.Image}}' "$container")" || { echo "ADOPT_REJECTED missing" >&2; exit 1; }
  docker image inspect "$image_id" > "$work/image.json" || { echo "ADOPT_REJECTED missing" >&2; exit 1; }
fi

decision="$(ADOPT_CONTAINER="$container" ADOPT_DEPLOYMENT_ENV="$deployment_env" ADOPT_PORT="$port" node "$here/assess-adoption.mjs" "$work/container.json" "$work/image.json")" || exit 1
read -r _marker adopt_sha adopt_digest adopt_image <<<"$decision"
export RELEASE_SHA="$adopt_sha" RELEASE_DIGEST="$adopt_digest" RELEASE_RUN_ID="$ADOPT_RUN_ID" RELEASE_RUN_ATTEMPT=1 RELEASE_IMAGE="$adopt_image"
node "$here/release-state.mjs" commit "$state" "$state_env" "$service" >/dev/null
echo "ADOPT_RECORDED ${environment} ${service} ${adopt_sha}"
