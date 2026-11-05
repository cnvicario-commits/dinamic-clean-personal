#!/usr/bin/env bash
# Closed command list for a future production deploy key.
# This key is distinct from the Cristian key and is not installed in Phase 4.
set -euo pipefail

command="${SSH_ORIGINAL_COMMAND:-}"
root="${PRODUCTION_CHECKOUT:-/opt/dinamic-clean}"

case "$command" in
  "production-apply "*)
    set -- $command
    [[ "$2" =~ ^[0-9a-f]{40}$ ]] || { echo "AUTHORIZED_COMMAND_REJECTED sha" >&2; exit 2; }
    exec "$root/scripts/deploy/production-remote-apply.sh" "$2"
    ;;
  "production-rollback "*)
    set -- $command
    [[ "$2" =~ ^[0-9a-f]{40}$ ]] || { echo "AUTHORIZED_COMMAND_REJECTED sha" >&2; exit 2; }
    exec "$root/scripts/deploy/production-remote-rollback.sh" "$2"
    ;;
  *)
    echo "AUTHORIZED_COMMAND_REJECTED" >&2
    exit 2
    ;;
esac
