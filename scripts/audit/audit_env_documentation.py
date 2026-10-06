#!/usr/bin/env python3
"""Compare environment variable usage against .env.example documentation (Dinamic Clean)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

ENV_EXAMPLE_FILES = [
    REPO_ROOT / "apps" / "api" / ".env.example",
]
SCAN_PATHS = [
    REPO_ROOT / "apps" / "api" / "src",
    REPO_ROOT / "src",
    REPO_ROOT / "scripts",
    REPO_ROOT / "deploy",
]

PROCESS_ENV = re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)")
ENV_DOT = re.compile(r"\benv\.([A-Z][A-Z0-9_]*)")
ZOD_KEY = re.compile(r"^\s*([A-Z][A-Z0-9_]*)\s*:\s*z\.", re.M)

# Documented in example only for local Next — not required in API example.
FRONTEND_ONLY = {
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_API_URL",
}

SCRIPT_ONLY = {
    "RUN_DB_COMPATIBILITY_CHECK",
    "RUN_SUPABASE_INTEGRATION",
    "RUN_VENTAS_SMOKE",
    "EXPECTED_SUPABASE_TEST_PROJECT_REF",
    "SMOKE_TEST_ADMIN_EMAIL",
    "SMOKE_TEST_ADMIN_PASSWORD",
}


def read_documented_keys() -> set[str]:
    keys: set[str] = set()
    for path in ENV_EXAMPLE_FILES:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                keys.add(line.split("=", 1)[0].strip())
    env_ts = REPO_ROOT / "apps" / "api" / "src" / "config" / "env.ts"
    if env_ts.exists():
        keys.update(ZOD_KEY.findall(env_ts.read_text(encoding="utf-8", errors="replace")))
    return keys


def collect_used_keys() -> set[str]:
    used: set[str] = set()
    for base in SCAN_PATHS:
        if not base.exists():
            continue
        if base.is_file():
            text = base.read_text(encoding="utf-8", errors="replace")
            used.update(PROCESS_ENV.findall(text))
            used.update(ENV_DOT.findall(text))
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if "node_modules" in path.parts or "dist" in path.parts:
                continue
            if path.suffix not in {".ts", ".tsx", ".js", ".mjs", ".sh", ".yml", ".yaml"}:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            used.update(PROCESS_ENV.findall(text))
            used.update(ENV_DOT.findall(text))
    return used


def main() -> int:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    documented = read_documented_keys()
    used = collect_used_keys()
    missing = sorted(
        k
        for k in used
        if k not in documented and k not in FRONTEND_ONLY and k not in SCRIPT_ONLY
    )

    lines = [
        "# Environment documentation audit (Dinamic Clean)",
        "",
        f"- Documented keys (example + env.ts): {len(documented)}",
        f"- Used keys (scan): {len(used)}",
        "",
    ]
    if missing:
        lines.append("## Undocumented used variables")
        lines.extend(f"- {k}" for k in missing)
        lines.append("")
        lines.append("STATUS: FAIL")
        body = "\n".join(lines)
        if out_path:
            out_path.write_text(body, encoding="utf-8")
        print(body)
        return 1

    lines.append("All scanned API-related variables are documented or exempt.")
    lines.append("STATUS: PASS")
    body = "\n".join(lines)
    if out_path:
        out_path.write_text(body, encoding="utf-8")
    print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
