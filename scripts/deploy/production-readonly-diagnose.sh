#!/usr/bin/env bash
# Prints read-only commands. It does not open SSH and it does not change the VPS.
set -euo pipefail

cat <<'EOF'
# Run on the production host, read only. Do not pipe this into a shell from CI.
docker ps --filter name=dinamic-clean-api --format '{{.ID}} {{.Image}} {{.Ports}} {{.Status}}'
docker inspect dinamic-clean-api --format 'image={{.Image}} name={{.Name}} ports={{json .HostConfig.PortBindings}} env_count={{len .Config.Env}}'
ss -ltnp | awk '/:3005/'
EOF
echo "PRODUCTION_DIAGNOSE_NOT_EXECUTED"
