#!/usr/bin/env bash
# Copy the privileged deploy scripts into a root-owned directory.
# Without --apply-to this only prints the procedure and does not copy anything.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$script_dir/../.." && pwd)"
dest=""
if [[ "${1:-}" == "--apply-to" ]]; then
  dest="${2:?destination}"
fi

bin_files=(
  "scripts/deploy/cristian-remote-apply.sh:cristian-apply"
  "scripts/deploy/cristian-remote-rollback.sh:cristian-rollback"
  "scripts/deploy/production-remote-apply.sh:production-apply"
  "scripts/deploy/production-remote-rollback.sh:production-rollback"
  "scripts/deploy/authorized-command.sh:cristian-ssh"
  "scripts/deploy/production-authorized-command.sh:production-ssh"
  "scripts/deploy/load-cristian-deploy-env.sh:load-cristian-deploy-env.sh"
  "scripts/deploy/acquire-service-lock.sh:acquire-service-lock.sh"
  "scripts/deploy/recreate-one.sh:recreate-one.sh"
  "scripts/deploy/adopt-release.sh:adopt-release"
  "scripts/deploy/with-service-lock.py:with-service-lock.py"
)
compose_files=(
  "deploy/docker-compose.cristian.yml:docker-compose.cristian.yml"
  "deploy/docker-compose.cristian-frontend.yml:docker-compose.cristian-frontend.yml"
)

if [[ -z "$dest" ]]; then
  cat <<'EOF'
install -d -o root -g root -m 755 /opt/dinamic-clean-privileged/bin
install -d -o root -g root -m 755 /opt/dinamic-clean-privileged/compose
install -d -o root -g root -m 700 /var/lib/dinamic-clean/cristian
install -d -o root -g root -m 700 /var/lib/dinamic-clean/production
install -d -o root -g root -m 700 /etc/dinamic-clean
EOF
  for item in "${bin_files[@]}"; do
    printf 'install -o root -g root -m 755 %s /opt/dinamic-clean-privileged/bin/%s\n' "${item%%:*}" "${item##*:}"
  done
  printf 'install -o root -g root -m 644 scripts/deploy/*.mjs /opt/dinamic-clean-privileged/bin/\n'
  for item in "${compose_files[@]}"; do
    printf 'install -o root -g root -m 644 %s /opt/dinamic-clean-privileged/compose/%s\n' "${item%%:*}" "${item##*:}"
  done
  echo "Place the reviewed production Compose file at /opt/dinamic-clean-privileged/compose/api.yml"
  echo "PRIVILEGED_INSTALL_NOT_EXECUTED"
  exit 0
fi

mkdir -p "$dest/bin" "$dest/compose"
for item in "${bin_files[@]}"; do
  source_path="$repo/${item%%:*}"
  target="$dest/bin/${item##*:}"
  [[ -f "$source_path" && ! -L "$source_path" ]] || { echo "PRIVILEGED_INSTALL_REJECTED missing ${item%%:*}" >&2; exit 1; }
  cp "$source_path" "$target"
  chmod 755 "$target"
done
for file in "$script_dir"/*.mjs; do
  [[ -f "$file" && ! -L "$file" ]] || { echo "PRIVILEGED_INSTALL_REJECTED symlink" >&2; exit 1; }
  cp "$file" "$dest/bin/$(basename "$file")"
  chmod 644 "$dest/bin/$(basename "$file")"
done
for item in "${compose_files[@]}"; do
  source_path="$repo/${item%%:*}"
  [[ -f "$source_path" && ! -L "$source_path" ]] || { echo "PRIVILEGED_INSTALL_REJECTED missing ${item%%:*}" >&2; exit 1; }
  cp "$source_path" "$dest/compose/${item##*:}"
  chmod 644 "$dest/compose/${item##*:}"
done

required=(
  path-boundary.mjs release-state.mjs assess-health.mjs assess-production-compose.mjs
  assert-service-image.mjs assess-adoption.mjs load-cristian-deploy-env.sh
  acquire-service-lock.sh recreate-one.sh with-service-lock.py adopt-release
  cristian-apply cristian-rollback production-apply production-rollback
)
for name in "${required[@]}"; do
  [[ -f "$dest/bin/$name" && ! -L "$dest/bin/$name" ]] || { echo "PRIVILEGED_INSTALL_REJECTED absent $name" >&2; exit 1; }
done
if find "$dest" -type l | grep -q .; then
  echo "PRIVILEGED_INSTALL_REJECTED symlink" >&2
  exit 1
fi
if [[ "$(id -u)" == "0" ]]; then
  chown -R root:root "$dest"
  echo "PRIVILEGED_INSTALL_OWNER root"
else
  echo "PRIVILEGED_INSTALL_OWNER_UNVERIFIED"
fi
echo "PRIVILEGED_INSTALL_APPLIED"
