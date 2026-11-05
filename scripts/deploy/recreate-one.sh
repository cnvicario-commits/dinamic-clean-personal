# shellcheck shell=bash
# Sourced by apply and rollback. Recreates one Compose service and checks
# the container is the image Compose rendered.
recreate_one() {
  : "${here:?}"
  local compose="$1" service="$2" image_ref="$3" release_sha="$4"
  node "$here/path-boundary.mjs" expect-privileged "$compose" >/dev/null || return 1
  if [[ -n "${FIXTURE_RECREATE_LOG:-}" ]]; then
    printf '%s\n' "$service" >> "$FIXTURE_RECREATE_LOG"
  fi
  if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
    [[ "${FIXTURE_RECREATE:-ok}" == "ok" ]]
    return
  fi
  if [[ "${DINAMIC_DISPOSABLE_DOCKER:-}" == "1" ]]; then
    local text
    text="$(cat "$compose")" || return 1
    [[ "$text" == *"name: dinamic-crtest-"* ]] || { echo "DEPLOY_REJECTED disposable_project" >&2; return 2; }
    [[ "$text" != *"dinamic-clean-api"* && "$text" != *"dinamic-clean-cristian"* ]] || { echo "DEPLOY_REJECTED disposable_name" >&2; return 2; }
    [[ "$text" != *"3005"* && "$text" != *"3006"* && "$text" != *"8086"* ]] || { echo "DEPLOY_REJECTED disposable_port" >&2; return 2; }
  fi
  export APP_RELEASE_SHA="$release_sha"
  local rendered
  rendered="$(docker compose -f "$compose" config --format json)" || return 1
  printf '%s' "$rendered" | SERVICE="$service" EXPECTED_IMAGE="$image_ref" node "$here/assert-service-image.mjs" >/dev/null || return 1
  docker compose -f "$compose" up -d --no-deps --no-build --force-recreate "$service" || return 1
  local cid actual expected_id
  cid="$(docker compose -f "$compose" ps -q "$service")" || return 1
  [[ -n "$cid" ]] || return 1
  actual="$(docker inspect --format '{{.Image}}' "$cid")" || return 1
  expected_id="$(docker image inspect "$image_ref" --format '{{.Id}}')" || return 1
  [[ "$actual" == "$expected_id" ]]
}
