#!/usr/bin/env bash
# Print a Cristian frontend vhost. Does not install it and does not reload Nginx.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
domain="${CRISTIAN_FRONTEND_DOMAIN:-}"
port="${CRISTIAN_FRONTEND_HOST_PORT:-}"

if [[ ! "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "ERROR: CRISTIAN_FRONTEND_DOMAIN must be a concrete hostname" >&2
  exit 1
fi
if [[ "$domain" == *"*"* || "$domain" == "localhost" || "$domain" == *".local" || "$domain" == *".invalid" || "$domain" == *".test" || "$domain" == *.example || "$domain" == example.com || "$domain" == example.org || "$domain" == example.net || "$domain" == *.example.com || "$domain" == *.example.org || "$domain" == *.example.net || "$domain" == *".vercel.app" || "$domain" == *"biectbcujabpjhinouil"* ]]; then
  echo "ERROR: CRISTIAN_FRONTEND_DOMAIN is not a public frontend hostname" >&2
  exit 1
fi
if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1024 || port > 65535 )); then
  echo "ERROR: CRISTIAN_FRONTEND_HOST_PORT must be a free high port" >&2
  exit 1
fi
if [[ "$port" == "3005" || "$port" == "3006" ]]; then
  echo "ERROR: CRISTIAN_FRONTEND_HOST_PORT is reserved" >&2
  exit 1
fi

template="${ROOT}/deploy/nginx/dinamic-clean-cristian-frontend.conf.template"
python3 - "$template" "$domain" "$port" <<'PY'
import pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text()
text = text.replace("__CRISTIAN_FRONTEND_DOMAIN__", sys.argv[2]).replace("__CRISTIAN_FRONTEND_HOST_PORT__", sys.argv[3])
if "__CRISTIAN_FRONTEND_" in text:
    raise SystemExit("template substitution incomplete")
if "0.0.0.0" in text or "default_server" in text or "*." in text:
    raise SystemExit("rendered vhost is too broad")
sys.stdout.write(text)
PY
