#!/usr/bin/env bash
# Capture a command's real exit code into an evidence snippet.
# Usage: ./scripts/capture_cmd_exit.sh evidence/out.txt -- command args...
set -uo pipefail

if [[ $# -lt 3 || "$2" != "--" ]]; then
  echo "usage: $0 <outfile> -- <command> [args...]" >&2
  exit 2
fi

OUT="$1"
shift 2

{
  echo "command: $*"
  set +e
  "$@"
  code=$?
  set -e
  echo "exit_code=${code}"
  if [[ "${code}" -eq 0 ]]; then
    echo "result=PASS"
  else
    echo "result=FAIL"
  fi
  exit "${code}"
} >"${OUT}" 2>&1
