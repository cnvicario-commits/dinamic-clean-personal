#!/usr/bin/env python3
"""CI gate: fail only on unaccepted frontend npm audit Critical/High (see accepted_dependency_risks.json)."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from check_enrichment import parse_npm_audit
from npm_audit_policy import evaluate_frontend_npm_audit, load_accepted_risk_config


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    proc = subprocess.run(
        ["npm", "audit", "--json"],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    raw = proc.stdout.strip() or proc.stderr.strip() or "{}"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        tmp.write(raw)
        audit_path = Path(tmp.name)

    audit_info = parse_npm_audit(audit_path)
    audit_path.unlink(missing_ok=True)

    if not audit_info.get("available"):
        print("frontend npm audit gate: could not parse npm audit output", file=sys.stderr)
        return 1

    config = load_accepted_risk_config(repo)
    policy = evaluate_frontend_npm_audit(audit_info, config)

    for risk in policy.get("accepted_risks") or []:
        print(
            f"ACCEPTED_RISK {risk['id']} severity={risk['severity']} "
            f"packages={','.join(risk.get('packages') or [])}"
        )

    if policy.get("blocking"):
        print(
            "frontend npm audit gate: BLOCKING unaccepted packages: "
            f"{policy.get('unaccepted_package_names')}",
            file=sys.stderr,
        )
        print(f"unaccepted_counts: {policy.get('unaccepted_counts')}", file=sys.stderr)
        return 1

    print("frontend npm audit gate: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
