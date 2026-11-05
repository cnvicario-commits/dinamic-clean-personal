#!/usr/bin/env bash
# Prints the later installation steps. It does not create users or copy files.
set -euo pipefail

cat <<'EOF'
install -d -o root -g root -m 755 /opt/dinamic-clean-privileged/bin
install -d -o root -g root -m 755 /opt/dinamic-clean-privileged/compose
install -d -o root -g root -m 700 /var/lib/dinamic-clean/cristian
install -d -o root -g root -m 700 /var/lib/dinamic-clean/production
install -d -o root -g root -m 700 /etc/dinamic-clean
install -o root -g root -m 755 scripts/deploy/cristian-remote-apply.sh /opt/dinamic-clean-privileged/bin/cristian-apply
install -o root -g root -m 755 scripts/deploy/cristian-remote-rollback.sh /opt/dinamic-clean-privileged/bin/cristian-rollback
install -o root -g root -m 755 scripts/deploy/production-remote-apply.sh /opt/dinamic-clean-privileged/bin/production-apply
install -o root -g root -m 755 scripts/deploy/production-remote-rollback.sh /opt/dinamic-clean-privileged/bin/production-rollback
install -o root -g root -m 755 scripts/deploy/authorized-command.sh /opt/dinamic-clean-privileged/bin/cristian-ssh
install -o root -g root -m 755 scripts/deploy/production-authorized-command.sh /opt/dinamic-clean-privileged/bin/production-ssh
install -o root -g root -m 644 scripts/deploy/*.mjs /opt/dinamic-clean-privileged/bin/
EOF
echo "PRIVILEGED_INSTALL_NOT_EXECUTED"
