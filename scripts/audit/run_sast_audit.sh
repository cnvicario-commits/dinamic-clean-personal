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
    --json --quiet "${scan_paths[@]}" > "${SAST_JSON}" 2>> "${SAST_LOG}"
  sast_exit=$?
  finding_count=0
  if [[ -s "${SAST_JSON}" ]]; then
    finding_count="$(SAST_JSON_PATH="${SAST_JSON}" python3 - <<'PY'
import json
import os
from pathlib import Path
p = Path(os.environ["SAST_JSON_PATH"])
try:
    data = json.loads(p.read_text(encoding="utf-8"))
except json.JSONDecodeError:
    print(-1)
    raise SystemExit
print(len(data.get("results") or []))
PY
)"
  fi
  if [[ "${finding_count}" == "-1" ]] || [[ ! -s "${SAST_JSON}" ]]; then
    write_status_json "security-sast" "error" "high" "Semgrep failed (see security-sast-semgrep.txt)"
  elif [[ "${finding_count}" -gt 0 ]]; then
    write_status_json "security-sast" "findings" "high" "Semgrep reported ${finding_count} finding(s)"
  elif [[ "${sast_exit}" -ne 0 && "${sast_exit}" -ne 1 ]]; then
    write_status_json "security-sast" "error" "high" "Semgrep exited ${sast_exit}"
  else
    write_status_json "security-sast" "pass" "none" "Semgrep completed (0 findings)"
  fi
else
  {
    echo "STATUS: NOT_RUN"
    echo "semgrep not installed or scan paths missing"
  } > "${SAST_LOG}"
  echo '{"status":"NOT_RUN","results":[]}' > "${SAST_JSON}"
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
