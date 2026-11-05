#!/usr/bin/env bash
# Print a Cristian API vhost. Does not install it and does not reload Nginx.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
domain="${DEMO_API_DOMAIN:-}"
port="${CRISTIAN_API_HOST_PORT:-}"

if [[ ! "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "ERROR: DEMO_API_DOMAIN must be a concrete hostname" >&2
  exit 1
fi
if [[ "$domain" == *"*"* || "$domain" == "localhost" || "$domain" == *".local" ]]; then
  echo "ERROR: DEMO_API_DOMAIN is not a public demo hostname" >&2
  exit 1
fi
if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1024 || port > 65535 )); then
  echo "ERROR: CRISTIAN_API_HOST_PORT must be a free high port chosen after the VPS survey" >&2
  exit 1
fi

template="${ROOT}/deploy/nginx/dinamic-clean-cristian-api.conf.template"
python3 - "$template" "$domain" "$port" <<'PY'
import pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text()
text = text.replace("__DEMO_API_DOMAIN__", sys.argv[2]).replace("__CRISTIAN_API_HOST_PORT__", sys.argv[3])
if "__DEMO_API_DOMAIN__" in text or "__CRISTIAN_API_HOST_PORT__" in text:
    raise SystemExit("template substitution incomplete")
if "0.0.0.0" in text or "default_server" in text or "*." in text:
    raise SystemExit("rendered vhost is too broad")
sys.stdout.write(text)
PY
