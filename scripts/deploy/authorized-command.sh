#!/usr/bin/env bash
# ForceCommand template. It executes only the privileged copies, never the checkout.
set -euo pipefail

command="${SSH_ORIGINAL_COMMAND:-}"
bin="/opt/dinamic-clean-privileged/bin"
if [[ "${DINAMIC_DEPLOY_FIXTURE:-}" == "1" && -n "${DINAMIC_PRIVILEGED_BIN:-}" ]]; then
  bin="$DINAMIC_PRIVILEGED_BIN"
fi
node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/path-boundary.mjs" expect-privileged "$bin" >/dev/null

if [[ "$command" =~ ^(cristian-apply)[[:space:]]+(api|frontend)[[:space:]]+([0-9a-f]{40})[[:space:]]+(sha256:[a-f0-9]{64})[[:space:]]+([1-9][0-9]*)$ ]]; then
  exec "$bin/cristian-apply" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}" "${BASH_REMATCH[5]}"
fi
if [[ "$command" =~ ^(cristian-rollback)[[:space:]]+(api|frontend)$ ]]; then
  exec "$bin/cristian-rollback" "${BASH_REMATCH[2]}"
fi
echo "AUTHORIZED_COMMAND_REJECTED" >&2
exit 2
