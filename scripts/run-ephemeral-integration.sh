#!/usr/bin/env bash
# Ephemeral integration. Fails if Docker, the CLI, schema apply, or the suite fails.
# Never falls back to a hosted Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "DOCKER_UNAVAILABLE"
  exit 1
fi

if command -v supabase >/dev/null 2>&1; then
  SB=(supabase)
elif command -v npx >/dev/null 2>&1; then
  SB=(npx --yes supabase)
else
  echo "SUPABASE_CLI_UNAVAILABLE"
  exit 1
fi

STARTED=0
start_log=""
status_env=""
cleanup() {
  [[ -n "$start_log" ]] && rm -f "$start_log"
  [[ -n "$status_env" ]] && rm -f "$status_env"
  if [[ "$STARTED" == 1 ]]; then
    "${SB[@]}" stop --no-backup >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if "${SB[@]}" status -o env >/dev/null 2>&1; then
  echo "LOCAL_SUPABASE_ALREADY_RUNNING"
  echo "An existing local Supabase stack is up. Ephemeral integration will not reset or stop it."
  exit 1
fi

echo "Starting local Supabase"
start_log="$(mktemp)"
if ! "${SB[@]}" start >"$start_log" 2>&1; then
  echo "SUPABASE_START_FAILED"
  sed -E 's#postgres(ql)?://[^[:space:]]+#postgresql://[redacted]#g' "$start_log" \
    | grep -E -v 'eyJ|sb_secret_|sb_publishable_|SERVICE_ROLE|JWT_SECRET|S3_PROTOCOL|SECRET_KEY|ANON_KEY' \
    | tail -40
  exit 1
fi
rm -f "$start_log"
start_log=""
STARTED=1

status_env="$(mktemp)"
if ! "${SB[@]}" status -o env >"$status_env" 2>/dev/null; then
  echo "LOCAL_SUPABASE_STATUS_FAILED"
  exit 1
fi
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#export }"
  [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"
  val="${BASH_REMATCH[2]}"
  val="${val%\"}"
  val="${val#\"}"
  printf -v "$key" '%s' "$val"
  export "$key"
done <"$status_env"
rm -f "$status_env"
status_env=""
db_candidate="${DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$db_candidate" ]]; then
  echo "DB_URL missing from supabase status"
  exit 1
fi

db_host="$(node -e 'try{const h=new URL(process.argv[1]).hostname.toLowerCase().replace(/^\[|\]$/g,""); if(!["localhost","127.0.0.1","::1"].includes(h)) process.exit(2); process.stdout.write(h)}catch{process.exit(2)}' "$db_candidate")" || {
  echo "LOCAL_SUPABASE_URL_NOT_LOOPBACK"
  exit 1
}
echo "Local database host ${db_host}"

admin_url="$(node -e 'const u=new URL(process.argv[1]); u.username="supabase_admin"; process.stdout.write(u.href)' "$db_candidate")"
node "$ROOT/scripts/disposable-target.mjs" "$admin_url"
psql "$admin_url" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION supabase_admin; GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;" >/dev/null
export RESTORE_TARGET_DB_URL="$admin_url"
./scripts/restore-development.sh

api_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
psql "$admin_url" -v ON_ERROR_STOP=1 -v api_password="$api_password" >/dev/null <<'SQL'
ALTER ROLE dinamic_api PASSWORD :'api_password';
SQL
export DINAMIC_LOCAL_DATABASE_URL="$(node -e 'const u=new URL(process.argv[1]); u.username="dinamic_api"; u.password=process.argv[2]; process.stdout.write(u.href)' "$db_candidate" "$api_password")"
unset api_password

export USE_LOCAL_SUPABASE=1
node apps/api/scripts/run-integration-with-env.mjs \
  tests/http.integration.test.ts \
  tests/crm-date-postgres.integration.test.ts \
  tests/postgrest-phase4b-rls.negative.test.ts
