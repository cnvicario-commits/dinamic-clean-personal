#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORWARD_DIR="${ROOT}/supabase/migrations/forward"

# CI/CD must inject MIGRATIONS_DATABASE_URL as a deployment-only secret. For
# local development, read only that exact key from apps/api/.env when it was
# not exported. Do not source the file: shell evaluation could execute content
# from a local secrets file.
load_local_migrations_database_url() {
  local env_file="${ROOT}/apps/api/.env"
  local line value

  [[ -n "${MIGRATIONS_DATABASE_URL:-}" || ! -f "$env_file" ]] && return

  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      MIGRATIONS_DATABASE_URL=*)
        value="${line#MIGRATIONS_DATABASE_URL=}"
        value="${value%$'\r'}"
        if [[ ${#value} -ge 2 ]] && { [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]] || [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; }; then
          value="${value:1:${#value}-2}"
        fi
        export MIGRATIONS_DATABASE_URL="$value"
        return
        ;;
    esac
  done < "$env_file"
}

load_local_migrations_database_url
: "${MIGRATIONS_DATABASE_URL:?MIGRATIONS_DATABASE_URL is required (export it in CI/CD or set it in apps/api/.env for local execution)}"

psql "$MIGRATIONS_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create schema if not exists app_migrations;
create table if not exists app_migrations.forward_history (
  filename text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
SQL

while IFS= read -r file; do
  name="$(basename "$file")"
  checksum="$(shasum -a 256 "$file" | awk '{print $1}')"
  recorded="$(psql "$MIGRATIONS_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "select checksum from app_migrations.forward_history where filename = '$name'")"
  if [[ -n "$recorded" ]]; then
    [[ "$recorded" == "$checksum" ]] || { echo "ERROR: checksum drift for $name" >&2; exit 1; }
    echo "Already applied $name"
    continue
  fi
  echo "Applying $name"
  { echo 'begin;'; cat "$file"; printf "\ninsert into app_migrations.forward_history(filename,checksum) values ('%s','%s');\ncommit;\n" "$name" "$checksum"; } |
    psql "$MIGRATIONS_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null
done < <(find "$FORWARD_DIR" -maxdepth 1 -type f -name '*.sql' ! -name '*.rollback.sql' | LC_ALL=C sort)
