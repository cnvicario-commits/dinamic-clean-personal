# shellcheck shell=bash
# Sourced by a privileged script. The flock stays open in the Python parent
# until that script exits, including the pull, recreate, health check, and record update.
acquire_service_lock() {
  : "${here:?}"
  local lock_file="$1"
  shift
  if [[ "${DINAMIC_LOCK_HELD:-}" == "1" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "$lock_file")"
  export DINAMIC_LOCK_HELD=1
  exec python3 "$here/with-service-lock.py" "$lock_file" bash "$0" "$@"
}
