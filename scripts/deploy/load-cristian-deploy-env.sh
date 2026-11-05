#!/usr/bin/env bash
# Load the fixed Cristian deploy file. Values are not printed.
file="${CRISTIAN_DEPLOY_ENV_FILE:-/etc/dinamic-clean/cristian.env}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$here/path-boundary.mjs" "$file" >/dev/null
[[ -f "$file" ]] || { echo "DEPLOY_REJECTED deploy_env" >&2; exit 2; }
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    CRISTIAN_SUPABASE_CA_FILE|CRISTIAN_API_HOST_PORT|CRISTIAN_API_CPUS|CRISTIAN_API_MEMORY|CRISTIAN_ENV_FILE|CRISTIAN_NEXT_PUBLIC_SUPABASE_URL|CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY|CRISTIAN_NEXT_PUBLIC_API_URL|CRISTIAN_FRONTEND_HOST_PORT|CRISTIAN_FRONTEND_CPUS|CRISTIAN_FRONTEND_MEMORY|APP_DEPLOYMENT_ENV|CRISTIAN_REGISTRY)
      export "$key=$value"
      ;;
    *)
      echo "DEPLOY_REJECTED deploy_env_key" >&2
      exit 2
      ;;
  esac
done < "$file"
