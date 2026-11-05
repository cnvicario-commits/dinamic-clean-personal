#!/usr/bin/env bash
# Roll one Cristian service back to its own previous successful image.
set -euo pipefail

service="${1:?usage: cristian-remote-rollback.sh api|frontend}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$here/path-boundary.mjs" "$here" >/dev/null
case "$service" in
  api|frontend) ;;
  *) echo "ROLLBACK_REJECTED service" >&2; exit 2 ;;
esac
state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/cristian}"
restore="$(node "$here/release-state.mjs" rollback-plan "$state" cristian "$service")" || exit 1
read -r _ restore_sha restore_digest restore_image <<<"$restore"
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" ]]; then
  [[ "${FIXTURE_RESTORE:-ok}" == "ok" ]] || { echo "ROLLBACK_FAILED ${service}" >&2; exit 1; }
else
  docker image inspect "$restore_image" >/dev/null || { echo "ROLLBACK_FAILED ${service} image_absent" >&2; exit 1; }
fi
node "$here/release-state.mjs" rollback-commit "$state" cristian "$service" >/dev/null
echo "ROLLBACK_CONFIRMED ${service} ${restore_sha} ${restore_digest}"
