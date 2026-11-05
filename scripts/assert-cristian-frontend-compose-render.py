#!/usr/bin/env python3
"""Check a rendered Cristian frontend compose config. Does not start a container."""
import re
import sys

text = sys.stdin.read()
port, sha = sys.argv[1], sys.argv[2]
checks = {
    "public_bind": "host_ip: 0.0.0.0" in text and f'published: "{port}"' in text and "target: 3000" in text,
    "no_unverified_ip_bind": "host_ip: 170.239.85.196" not in text,
    "no_loopback_only": "host_ip: 127.0.0.1" not in text,
    "container": "container_name: dinamic-clean-cristian-frontend" in text,
    "api_service_absent": "container_name: dinamic-clean-cristian-api" not in text,
    "project": "name: dinamic-clean-cristian-frontend" in text,
    "image": f"image: dinamic-clean-frontend:{sha}" in text,
    "deployment": "APP_DEPLOYMENT_ENV: cristian-pruebas" in text,
    "internal_api": "http://dinamic-clean-cristian-api:3001" in text,
    "test_ref": "edruejzwwnixsjsadbgb" in text,
    "no_production_ref": "biectbcujabpjhinouil" not in text,
    "no_server_secrets": "SUPABASE_SERVICE_ROLE_KEY" not in text and "DATABASE_URL" not in text and "MIGRATIONS_DATABASE_URL" not in text,
    "no_docker_socket": "docker.sock" not in text,
    "not_privileged": "privileged: true" not in text,
    "not_host_network": "network_mode: host" not in text,
    "no_new_privileges": "no-new-privileges:true" in text,
    "non_root": "10001:10001" in text,
    "pid_limit": "pids_limit: 256" in text,
    "healthz": "/api/healthz" in text,
    "log_rotation": "max-size" in text,
    "external_network": "external: true" in text and re.search(r"(?m)^\s*name: dinamic-clean-cristian\s*$", text) is not None,
    "no_remove_orphans": "remove-orphans" not in text,
    "no_production_dir": "/opt/dinamic-clean" not in text,
    "tls_verification_stays_on": "NODE_TLS_REJECT_UNAUTHORIZED" not in text,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("frontend compose isolation checks failed: " + ", ".join(failed))
print("frontend_compose_config_ok")
