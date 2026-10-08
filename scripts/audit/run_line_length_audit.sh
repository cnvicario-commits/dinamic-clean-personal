#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

OUT="${AUDIT_RAW}/line-length-audit.txt"
OUT_JSON="${AUDIT_RAW}/line-length-audit.json"
exit_code=0
python3 "${SCRIPT_DIR}/collectors/line_length_check.py" "${OUT}" "${OUT_JSON}" || exit_code=$?

if [[ "${exit_code}" -eq 0 ]]; then
  write_status_json "line-length" "pass" "none" "No lines exceed readability warning threshold"
elif [[ "${exit_code}" -eq 1 ]]; then
  totals="$(python3 - <<PY
import json
from pathlib import Path
p = Path("${OUT_JSON}")
if not p.exists():
    print("long lines detected")
else:
    d = json.loads(p.read_text(encoding="utf-8"))
    t = d.get("totals", {})
    print(f">{t.get('over_warning', '?')} @120, >{t.get('over_high', '?')} @160, >{t.get('over_severe', '?')} @200")
PY
)"
  write_status_json "line-length" "findings" "medium" "Readability long lines: ${totals}"
elif [[ "${exit_code}" -eq 2 ]]; then
  write_status_json "line-length" "not_run" "info" "Line length collector disabled or not configured"
else
  write_status_json "line-length" "error" "high" "Line length collector failed"
fi
exit 0
