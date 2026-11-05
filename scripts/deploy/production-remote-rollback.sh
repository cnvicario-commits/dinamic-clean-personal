#!/usr/bin/env bash
# Restore the previous production API image recorded for this service.
# It does not roll back SQL and it does not run without a reviewed Compose copy.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$here/path-boundary.mjs" "$here" >/dev/null
if [[ "${PRODUCTION_COMPOSE_REVIEWED:-}" != "operator-reviewed" ]]; then
  echo "PRODUCTION_ROLLBACK_REJECTED compose_not_reviewed" >&2
  exit 2
fi
state="${DINAMIC_RELEASE_STATE_DIR:-/var/lib/dinamic-clean/production}"
node "$here/release-state.mjs" rollback-plan "$state" production api >/dev/null
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" != "1" ]]; then
  echo "PRODUCTION_ROLLBACK_REJECTED remote_execution_not_enabled" >&2
  exit 2
fi
node "$here/release-state.mjs" rollback-commit "$state" production api
echo "PRODUCTION_ROLLBACK_CONFIRMED"
