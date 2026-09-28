#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORWARD_DIR="${ROOT}/supabase/migrations/forward"
: "${RESTORE_TARGET_DB_URL:?RESTORE_TARGET_DB_URL is required}"

psql "$RESTORE_TARGET_DB_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
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
  recorded="$(psql "$RESTORE_TARGET_DB_URL" -At -v ON_ERROR_STOP=1 -c "select checksum from app_migrations.forward_history where filename = '$name'")"
  if [[ -n "$recorded" ]]; then
    [[ "$recorded" == "$checksum" ]] || { echo "ERROR: checksum drift for $name" >&2; exit 1; }
    echo "Already applied $name"
    continue
  fi
  echo "Applying $name"
  { echo 'begin;'; cat "$file"; printf "\ninsert into app_migrations.forward_history(filename,checksum) values ('%s','%s');\ncommit;\n" "$name" "$checksum"; } |
    psql "$RESTORE_TARGET_DB_URL" -v ON_ERROR_STOP=1 >/dev/null
done < <(find "$FORWARD_DIR" -maxdepth 1 -type f -name '*.sql' ! -name '*.rollback.sql' | LC_ALL=C sort)
