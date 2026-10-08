#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

FORWARD="${REPO_ROOT}/supabase/migrations/forward"
OUT="${AUDIT_RAW}/db-forward-migrations.txt"
MIG_TEST_OUT="${AUDIT_RAW}/db-migration-contract-tests.txt"

{
  echo "=== Forward migrations inventory ==="
  echo "PATH: supabase/migrations/forward"
  if [[ ! -d "${FORWARD}" ]]; then
    echo "STATUS: ERROR"
    echo "REASON: forward migrations directory missing"
  else
    count=0
    while IFS= read -r -d '' f; do
      echo "- $(basename "${f}")"
      count=$((count + 1))
    done < <(find "${FORWARD}" -maxdepth 1 -name '*.sql' -type f -print0 | sort -z)
    echo "TOTAL_SQL_FILES: ${count}"
    if [[ "${count}" -eq 0 ]]; then
      echo "STATUS: ERROR"
    else
      echo "STATUS: PASS"
    fi
  fi
} > "${OUT}"

inventory_status="pass"
if grep -q "STATUS: ERROR" "${OUT}"; then
  inventory_status="error"
  write_status_json "db-forward-inventory" "error" "critical" "Forward migrations directory missing or empty"
else
  write_status_json "db-forward-inventory" "pass" "none" "Forward migrations present"
fi

if ! BACKEND_DIR="$(detect_backend_dir)"; then
  write_status_json "db-migration-contract-tests" "skipped" "info" "API package not found"
  exit 0
fi

log_info "Running migration contract tests in ${BACKEND_DIR}"
test_exit=0
{
  echo "=== DB migration contract tests (vitest) ==="
  echo "COMMAND: npx vitest run tests/*migration*.test.ts tests/audits-db-validation.integration.test.ts"
  echo "WORKDIR: ${BACKEND_DIR}"
  echo "--- output ---"
} > "${MIG_TEST_OUT}"

(
  cd "${BACKEND_DIR}" && npx vitest run \
    tests/main-sync-ventas-migration.test.ts \
    tests/audits-db-validation.integration.test.ts \
    tests/crm-runtime-grants-migration.test.ts \
    tests/phase6a-policy-static.test.ts
) >> "${MIG_TEST_OUT}" 2>&1 || test_exit=$?

{
  echo "--- end output ---"
  echo "EXIT_CODE: ${test_exit}"
  if [[ "${test_exit}" -eq 0 ]]; then echo "STATUS: PASS"; else echo "STATUS: FAIL"; fi
} >> "${MIG_TEST_OUT}"

if [[ "${test_exit}" -eq 0 ]]; then
  write_status_json "db-migration-contract-tests" "pass" "none" "Migration contract tests passed"
else
  write_status_json "db-migration-contract-tests" "fail" "high" "Migration contract tests failed"
fi

if [[ "${inventory_status}" == "error" ]]; then
  exit 0
fi
exit 0
