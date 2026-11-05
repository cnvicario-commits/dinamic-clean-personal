#!/usr/bin/env bash
# ForceCommand template for production. It cannot run Cristian commands.
set -euo pipefail

command="${SSH_ORIGINAL_COMMAND:-}"
bin="/opt/dinamic-clean-privileged/bin"
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" && -n "${DINAMIC_PRIVILEGED_BIN:-}" ]]; then
  bin="$DINAMIC_PRIVILEGED_BIN"
fi
node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/path-boundary.mjs" "$bin" >/dev/null

if [[ "$command" =~ ^(production-apply)[[:space:]]+([0-9a-f]{40})[[:space:]]+(sha256:[a-f0-9]{64})[[:space:]]+([1-9][0-9]*)$ ]]; then
  exec "$bin/production-apply" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}"
fi
if [[ "$command" =~ ^(production-rollback)$ ]]; then
  exec "$bin/production-rollback"
fi
echo "AUTHORIZED_COMMAND_REJECTED" >&2
exit 2
