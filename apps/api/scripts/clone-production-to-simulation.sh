#!/usr/bin/env bash
# Read-only dump of production public+auth, restore onto an explicit simulation target.
# Refuses production and test targets. Does not print connection strings.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"
: "${EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF:?EXPECTED_SUPABASE_PRODUCTION_PROJECT_REF is required}"
: "${EXPECTED_SUPABASE_TEST_PROJECT_REF:?EXPECTED_SUPABASE_TEST_PROJECT_REF is required}"
: "${DB_COMPATIBILITY_TARGET:?DB_COMPATIBILITY_TARGET is required}"
: "${SIMULATION_CONFIRM:?SIMULATION_CONFIRM=yes is required}"

redact() {
  sed -E 's#postgres(ql)?://[^[:space:]]+#postgresql://[redacted]#g'
}

echo "Checking simulation target"
node "$API/scripts/assert-simulation-target.mjs"

DUMP_DIR="${DUMP_DIR:-/tmp/dinamic-clean-sim}"
DUMP_FILE="${DUMP_FILE:-$DUMP_DIR/prod-public-auth.dump}"
mkdir -p "$DUMP_DIR"
chmod 700 "$DUMP_DIR"

echo "Dumping production schemas public and auth (custom, no owner, no privileges)"
if ! PGSSLMODE=require pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=auth \
  --file="$DUMP_FILE" \
  "$SOURCE_DATABASE_URL" 2> >(redact >&2); then
  echo "BLOCKED_BY_SIMULATION_ENVIRONMENT dump_failed"
  exit 1
fi

echo "Preparing disposable target"
PGSSLMODE=disable psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL' 2> >(redact >&2)
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS app_migrations CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$$;
SQL

echo "Restoring dump into simulation"
LIST_FILE="${DUMP_DIR}/restore.list"
pg_restore --list "$DUMP_FILE" | sed -E '/SCHEMA - public /s/^/;/' > "$LIST_FILE"
if ! PGSSLMODE=disable pg_restore \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --use-list="$LIST_FILE" \
  --dbname="$TARGET_DATABASE_URL" \
  "$DUMP_FILE" 2> >(redact >&2); then
  echo "BLOCKED_BY_SIMULATION_ENVIRONMENT restore_failed"
  exit 1
fi

echo "Ensuring storage.objects exists for forward policy statements"
PGSSLMODE=disable psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL' 2> >(redact >&2)
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text
);
SQL

echo "Verifying restored public tables"
TABLES="$(PGSSLMODE=disable psql "$TARGET_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")"
echo "public_base_tables=${TABLES}"
if [[ "${TABLES}" -lt 30 ]]; then
  echo "BLOCKED_BY_SIMULATION_ENVIRONMENT restore_incomplete"
  exit 1
fi
echo "RESTORE_OK"
