#!/usr/bin/env bash
# Restore development / disposable DB from baseline (Phase 0/1 scaffolding).
# Does NOT print connection secrets. Fail-fast with ON_ERROR_STOP.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_DIR="${ROOT}/supabase/baseline"
FORWARD_DIR="${ROOT}/supabase/migrations/forward"
OPS_DIR="${ROOT}/supabase/ops"

# Historical migrations 0001–0033 are incorporated in 001_public_schema.sql.
# Restore must NOT re-apply supabase/migrations/0001_*.sql … 0033_*.sql.
# New deltas go under supabase/migrations/forward/ (see README there).
BASELINE_CUTOFF="${BASELINE_CUTOFF:-0033}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    die "${name} is required (refusing to guess a database URL)"
  fi
}

url_looks_like_prod() {
  local url="$1"
  local lower
  lower="$(printf '%s' "$url" | tr '[:upper:]' '[:lower:]')"
  # Obvious prod host markers — extend carefully; prefer I_CONFIRM_DISPOSABLE=yes for anything unclear.
  if [[ "$lower" == *"prod"* ]] \
    || [[ "$lower" == *"production"* ]] \
    || [[ "$lower" == *".prod."* ]] \
    || [[ "$lower" == *"supabase.co"* && "$lower" != *"edruejzwwnixsjsadbgb"* ]]; then
    # Note: any supabase.co host other than the known test project ref is treated as risky.
    # Override only with I_CONFIRM_DISPOSABLE=yes.
    return 0
  fi
  return 1
}

require_env RESTORE_TARGET_DB_URL

if url_looks_like_prod "$RESTORE_TARGET_DB_URL"; then
  if [[ "${I_CONFIRM_DISPOSABLE:-}" != "yes" ]]; then
    die "RESTORE_TARGET_DB_URL looks like a non-disposable/prod host. Set I_CONFIRM_DISPOSABLE=yes to override (disposable targets only)."
  fi
  echo "WARN: prod-like URL override accepted via I_CONFIRM_DISPOSABLE=yes" >&2
fi

if ! command -v psql >/dev/null 2>&1; then
  die "psql is required"
fi

apply_sql() {
  local file="$1"
  echo "Applying $(basename "$file") …"
  # Do not echo URL. ON_ERROR_STOP fails fast.
  psql "$RESTORE_TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$file" >/dev/null
}

echo "Restore target: (URL redacted)"
echo "BASELINE_CUTOFF=${BASELINE_CUTOFF} (historical migrations up to this id are NOT re-applied)"

# 1) Baseline public schema
SCHEMA="${BASELINE_DIR}/001_public_schema.sql"
[[ -f "$SCHEMA" ]] || die "Missing $SCHEMA"
# Tolerate existing public schema on blank Supabase DBs
sed -E 's/^CREATE SCHEMA public;/CREATE SCHEMA IF NOT EXISTS public;/' "$SCHEMA" \
  | psql "$RESTORE_TARGET_DB_URL" -v ON_ERROR_STOP=1 -f - >/dev/null

# 2) Grants (prefer baseline 002; fall back to ops script)
if [[ -f "${BASELINE_DIR}/002_grants.sql" ]]; then
  # Resolve \ir relative to baseline dir
  (
    cd "$BASELINE_DIR"
    psql "$RESTORE_TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "./002_grants.sql" >/dev/null
  )
elif [[ -f "${OPS_DIR}/create_api_role.sql" ]]; then
  apply_sql "${OPS_DIR}/create_api_role.sql"
else
  echo "WARN: no 002_grants.sql / create_api_role.sql — skipping grants" >&2
fi

# 3) Storage baseline if present
if [[ -f "${BASELINE_DIR}/003_storage.sql" ]]; then
  apply_sql "${BASELINE_DIR}/003_storage.sql"
else
  echo "NOTE: supabase/baseline/003_storage.sql not present — recreate buckets via dashboard if needed"
fi

# 4) Forward migrations only (post-baseline). Historical 0001–0033 stay for history.
if [[ -d "$FORWARD_DIR" ]]; then
  FORWARD_COUNT=0
  # Portable (macOS bash 3.2): no mapfile
  while IFS= read -r f; do
    [[ -n "$f" ]] || continue
    apply_sql "$f"
    FORWARD_COUNT=$((FORWARD_COUNT + 1))
  done < <(find "$FORWARD_DIR" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)
  if [[ "$FORWARD_COUNT" -eq 0 ]]; then
    echo "NOTE: no forward migrations under supabase/migrations/forward/ (baseline is current)"
  fi
else
  echo "NOTE: supabase/migrations/forward/ missing — create it for post-cutoff deltas"
fi

echo "Restore finished OK (BASELINE_CUTOFF=${BASELINE_CUTOFF}). Set dinamic_api password out-of-band if role was created."
