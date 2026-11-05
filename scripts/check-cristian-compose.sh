#!/usr/bin/env bash
# Syntax check only. It renders the Compose file with a temporary X.509 fixture.
# docker compose config is not a deploy preflight and does not prove the VPS CA.
# Before recreating the container, run scripts/preflight-cristian-deploy.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
probe_port="${CRISTIAN_API_HOST_PORT:-3199}"
probe_cpus="${CRISTIAN_API_CPUS:-0.25}"
probe_memory="${CRISTIAN_API_MEMORY:-256m}"
sha="${APP_RELEASE_SHA:-abc1234}"
probe_dir=""

cleanup() {
  if [[ -n "$probe_dir" ]]; then
    rm -rf "$probe_dir"
  fi
}
trap cleanup EXIT

probe_dir="$(mktemp -d)"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "${probe_dir}/key.pem" \
  -out "${probe_dir}/ca.crt" \
  -subj "/CN=cristian-compose-syntax-probe" \
  -days 1 >/dev/null 2>&1
rm -f "${probe_dir}/key.pem"
ca_file="${probe_dir}/ca.crt"

echo "syntax_check_only"
echo "docker_compose_config_is_not_a_deploy_preflight"
echo "limits_are_parse_probe_not_capacity"

rendered="$(
  CRISTIAN_ENV_FILE="${ROOT}/deploy/cristian.env.example" \
  CRISTIAN_API_HOST_PORT="$probe_port" \
  CRISTIAN_API_CPUS="$probe_cpus" \
  CRISTIAN_API_MEMORY="$probe_memory" \
  CRISTIAN_SUPABASE_CA_FILE="$ca_file" \
  APP_RELEASE_SHA="$sha" \
  docker compose -f "${ROOT}/deploy/docker-compose.cristian.yml" config
)"

printf '%s\n' "$rendered" | python3 "${ROOT}/scripts/assert-cristian-compose-render.py" "$probe_port" "$sha" "$ca_file"
echo "probe_port ${probe_port}"
