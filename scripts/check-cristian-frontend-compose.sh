#!/usr/bin/env bash
# Syntax check only. docker compose config is not a frontend deploy preflight.
# Before creating the container, run scripts/preflight-cristian-frontend.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
probe_port="${CRISTIAN_FRONTEND_HOST_PORT:-18086}"
probe_cpus="${CRISTIAN_FRONTEND_CPUS:-0.25}"
probe_memory="${CRISTIAN_FRONTEND_MEMORY:-256m}"
sha="${APP_RELEASE_SHA:-abc1234}"
supabase_url="${CRISTIAN_NEXT_PUBLIC_SUPABASE_URL:-https://edruejzwwnixsjsadbgb.supabase.co}"
api_url="${CRISTIAN_NEXT_PUBLIC_API_URL:-https://cristian-frontend.invalid}"
anon_key="${CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_cristian_probe}"

echo "syntax_check_only"
echo "docker_compose_config_is_not_a_deploy_preflight"
echo "limits_are_parse_probe_not_capacity"

CRISTIAN_FRONTEND_BUILD=1 \
  NODE_ENV=production \
  APP_DEPLOYMENT_ENV=cristian-pruebas \
  APP_RELEASE_SHA="$sha" \
  NEXT_PUBLIC_SUPABASE_URL="$supabase_url" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$anon_key" \
  NEXT_PUBLIC_API_URL="$api_url" \
  node "${ROOT}/scripts/assert-cristian-frontend-env.mjs" build >/dev/null

rendered="$(
  CRISTIAN_FRONTEND_HOST_PORT="$probe_port" \
  CRISTIAN_FRONTEND_CPUS="$probe_cpus" \
  CRISTIAN_FRONTEND_MEMORY="$probe_memory" \
  CRISTIAN_NEXT_PUBLIC_SUPABASE_URL="$supabase_url" \
  CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY="$anon_key" \
  CRISTIAN_NEXT_PUBLIC_API_URL="$api_url" \
  APP_RELEASE_SHA="$sha" \
  docker compose -f "${ROOT}/deploy/docker-compose.cristian-frontend.yml" config
)"

printf '%s\n' "$rendered" | python3 "${ROOT}/scripts/assert-cristian-frontend-compose-render.py" "$probe_port" "$sha"
echo "probe_port ${probe_port}"
