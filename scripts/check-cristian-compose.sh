#!/usr/bin/env bash
# Parse the Cristian compose file. The CPU, memory, and port below only prove
# the file renders. They are not a capacity decision and this script does not
# start a container.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
probe_port="${CRISTIAN_API_HOST_PORT:-3199}"
probe_cpus="${CRISTIAN_API_CPUS:-0.25}"
probe_memory="${CRISTIAN_API_MEMORY:-256m}"
sha="${APP_RELEASE_SHA:-abc1234}"

rendered="$(
  CRISTIAN_ENV_FILE="${ROOT}/deploy/cristian.env.example" \
  CRISTIAN_API_HOST_PORT="$probe_port" \
  CRISTIAN_API_CPUS="$probe_cpus" \
  CRISTIAN_API_MEMORY="$probe_memory" \
  APP_RELEASE_SHA="$sha" \
  docker compose -f "${ROOT}/deploy/docker-compose.cristian.yml" config
)"

printf '%s\n' "$rendered" | python3 -c '
import re, sys
text = sys.stdin.read()
port, sha = sys.argv[1], sys.argv[2]
match = re.search(r"MIGRATIONS_DATABASE_URL:\s*(.*)", text)
value = match.group(1).strip().replace("\"", "") if match else "missing"
blank = value in ("", "null", chr(39) + chr(39))
checks = {
    "loopback_port": "host_ip: 127.0.0.1" in text and f"published: \"{port}\"" in text and "target: 3001" in text,
    "no_wildcard_bind": "host_ip: 0.0.0.0" not in text,
    "container": "container_name: dinamic-clean-cristian-api" in text,
    "project": "name: dinamic-clean-cristian" in text,
    "image": f"image: dinamic-clean-api:{sha}" in text,
    "deployment": "APP_DEPLOYMENT_ENV: cristian-pruebas" in text,
    "test_ref": "EXPECTED_SUPABASE_PROJECT_REF: edruejzwwnixsjsadbgb" in text,
    "no_migrations_secret": blank,
    "no_production_ref": "biectbcujabpjhinouil" not in text,
    "no_docker_socket": "docker.sock" not in text,
    "not_privileged": "privileged: true" not in text,
    "not_host_network": "network_mode: host" not in text,
    "no_new_privileges": "no-new-privileges:true" in text,
    "non_root": "10001:10001" in text,
    "readyz": "/readyz" in text,
    "log_rotation": "max-size" in text,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("compose isolation checks failed: " + ", ".join(failed))
print("compose_config_ok")
print("limits_are_parse_probe_not_capacity")
print("probe_port", port)
' "$probe_port" "$sha"
