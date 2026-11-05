#!/usr/bin/env python3
"""Check a rendered Cristian compose config. Does not start a container."""
import re
import sys

text = sys.stdin.read()
port, sha, ca_file = sys.argv[1], sys.argv[2], sys.argv[3]
match = re.search(r"MIGRATIONS_DATABASE_URL:\s*(.*)", text)
value = match.group(1).strip().replace('"', "") if match else "missing"
blank = value in ("", "null", chr(39) + chr(39))
checks = {
    "loopback_port": "host_ip: 127.0.0.1" in text and f'published: "{port}"' in text and "target: 3001" in text,
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
    "ca_env": "NODE_EXTRA_CA_CERTS: /app/certs/supabase-ca.crt" in text,
    "ca_target": "target: /app/certs/supabase-ca.crt" in text,
    "ca_source": ca_file in text,
    "ca_read_only": "read_only: true" in text,
    "ca_not_created": "create_host_path: true" not in text,
    "tls_verification_stays_on": "NODE_TLS_REJECT_UNAUTHORIZED" not in text,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("compose isolation checks failed: " + ", ".join(failed))
print("compose_config_ok")
