#!/usr/bin/env bash
# Read-only dump of Supabase Test. Refuses every other destination.
# Writes outside the repository. Does not print the connection URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${ROOT}/apps/api/.env"

if [[ -z "${MIGRATIONS_DATABASE_URL:-}" && -f "$env_file" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      MIGRATIONS_DATABASE_URL=*)
        value="${line#MIGRATIONS_DATABASE_URL=}"
        value="${value%$'\r'}"
        if [[ ${#value} -ge 2 ]] && { [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]] || [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; }; then
          value="${value:1:${#value}-2}"
        fi
        export MIGRATIONS_DATABASE_URL="$value"
        break
        ;;
    esac
  done < "$env_file"
fi
: "${MIGRATIONS_DATABASE_URL:?MIGRATIONS_DATABASE_URL is required}"

unset DINAMIC_MIGRATION_TARGET
identity="$(node "${ROOT}/scripts/assert-migration-target.mjs" "$MIGRATIONS_DATABASE_URL")"
printf '%s\n' "$identity" | grep -q 'MIGRATION_TARGET test-cloud' || {
  echo "ERROR: backup refuses a destination that is not Supabase Test" >&2
  exit 1
}
printf '%s\n' "$identity"

dest="${HOME}/.dinamic-clean-backups"
mkdir -p "$dest"
chmod 700 "$dest"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="${dest}/test-edruejzwwnixsjsadbgb-${stamp}"
mkdir -m 700 "$out"

redact() {
  sed -E 's#postgres(ql)?://[^[:space:]]+#postgresql://[redacted]#g'
}

run_dump() {
  local label="$1"
  shift
  local err="${out}/${label}.err"
  if "$@" 2>"$err"; then
    rm -f "$err"
    chmod 600 "${out}/${label}.dump"
    local size
    size="$(wc -c <"${out}/${label}.dump" | tr -d ' ')"
    if [[ "$size" -le 0 ]]; then
      echo "ERROR: ${label} is empty" >&2
      exit 1
    fi
    echo "${label} bytes=${size}"
    return 0
  fi
  echo "${label} FAILED" >&2
  redact <"$err" >&2 || true
  rm -f "$err" "${out}/${label}.dump"
  return 1
}

run_dump public-and-history pg_dump "$MIGRATIONS_DATABASE_URL" \
  --format=custom --no-owner \
  --schema=public --schema=app_migrations \
  --file="${out}/public-and-history.dump"

run_dump auth-users pg_dump "$MIGRATIONS_DATABASE_URL" \
  --format=custom --no-owner --data-only \
  --table=auth.users \
  --file="${out}/auth-users.dump" || echo "auth-users not included"

run_dump storage-metadata pg_dump "$MIGRATIONS_DATABASE_URL" \
  --format=custom --no-owner --data-only \
  --table=storage.buckets --table=storage.objects \
  --file="${out}/storage-metadata.dump" || echo "storage-metadata not included"

echo "backup_dir ${out}"
echo "scope sql dump of public and app_migrations"
echo "auth_users_and_storage_metadata included only when the migration role can read them"
echo "not_included storage object bytes and Auth dashboard settings"
