#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

SAST_JSON="${AUDIT_RAW}/security-sast-semgrep.json"
GITLEAKS_JSON="${AUDIT_RAW}/security-gitleaks.json"
SAST_LOG="${AUDIT_RAW}/security-sast-semgrep.txt"
GITLEAKS_LOG="${AUDIT_RAW}/security-gitleaks.txt"

scan_paths=()
if [[ -d "${REPO_ROOT}/apps/api/src" ]]; then
  scan_paths+=("${REPO_ROOT}/apps/api/src")
fi
if [[ -d "${REPO_ROOT}/src" ]]; then
  scan_paths+=("${REPO_ROOT}/src")
fi

if command -v semgrep >/dev/null 2>&1 && [[ ${#scan_paths[@]} -gt 0 ]]; then
  export SEMGREP_USER_LOG_FILE="${AUDIT_RAW}/semgrep-user.log"
  semgrep --version > "${SAST_LOG}" 2>&1 || true
  semgrep scan --config auto --config p/typescript --config p/nodejs --config p/security-audit \
    --json --quiet "${scan_paths[@]}" > "${SAST_JSON}" 2>> "${SAST_LOG}" || true
  read -r sast_status finding_count error_count < <(
    python3 "${SCRIPT_DIR}/semgrep_evaluate.py" "${SAST_JSON}" | tr '\t' ' '
  )
  if [[ "${sast_status}" == "pass" ]]; then
    write_status_json "security-sast" "pass" "none" "Semgrep: findings=0 errors=0"
  elif [[ "${sast_status}" == "findings" ]]; then
    write_status_json "security-sast" "findings" "high" "Semgrep: findings=${finding_count} errors=${error_count}"
  else
    write_status_json "security-sast" "error" "high" "Semgrep: findings=${finding_count} errors=${error_count} (incomplete scan)"
  fi
else
  {
    echo "STATUS: NOT_RUN"
    echo "semgrep not installed or scan paths missing"
  } > "${SAST_LOG}"
  echo '{"status":"NOT_RUN","results":[],"errors":[]}' > "${SAST_JSON}"
  write_status_json "security-sast" "not_run" "info" "semgrep not available"
fi

if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks detect --no-banner --source "${REPO_ROOT}" --redact --report-path "${GITLEAKS_JSON}" \
    > "${GITLEAKS_LOG}" 2>&1; then
    write_status_json "security-gitleaks" "pass" "none" "Gitleaks completed (0 leaks)"
  else
    if [[ -f "${GITLEAKS_JSON}" ]] && grep -q '\[\]' "${GITLEAKS_JSON}" 2>/dev/null; then
      write_status_json "security-gitleaks" "pass" "none" "Gitleaks completed (0 leaks)"
    else
      write_status_json "security-gitleaks" "findings" "critical" "Gitleaks reported potential leaks"
    fi
  fi
else
  {
    echo "STATUS: NOT_RUN"
    echo "gitleaks not installed"
  } > "${GITLEAKS_LOG}"
  echo '[]' > "${GITLEAKS_JSON}"
  write_status_json "security-gitleaks" "not_run" "info" "gitleaks not available"
fi

exit 0
