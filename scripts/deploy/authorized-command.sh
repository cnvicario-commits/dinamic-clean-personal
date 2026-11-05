#!/usr/bin/env bash
# Closed command list for a future deploy key. It is not installed on the VPS.
# Docker group membership is intentionally absent: this script is the only command.
set -euo pipefail

command="${SSH_ORIGINAL_COMMAND:-}"
root="${CRISTIAN_CHECKOUT:-/opt/dinamic-clean-cristian}"

case "$command" in
  "cristian-apply api "*|"cristian-apply frontend "*|"cristian-apply both "*)
    set -- $command
    [[ "$3" =~ ^[0-9a-f]{40}$ ]] || { echo "AUTHORIZED_COMMAND_REJECTED sha" >&2; exit 2; }
    exec "$root/scripts/deploy/cristian-remote-apply.sh" "$2" "$3"
    ;;
  "cristian-rollback api "*|"cristian-rollback frontend "*|"cristian-rollback both "*)
    set -- $command
    [[ "$3" =~ ^[0-9a-f]{40}$ ]] || { echo "AUTHORIZED_COMMAND_REJECTED sha" >&2; exit 2; }
    exec "$root/scripts/deploy/cristian-remote-rollback.sh" "$2" "$3"
    ;;
  *)
    echo "AUTHORIZED_COMMAND_REJECTED" >&2
    exit 2
    ;;
esac
