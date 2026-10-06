"""Frontend npm audit acceptance policy (explicit risks only)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SEVERITY_ORDER = ["low", "moderate", "high", "critical"]

BRACES_DEV_CHAIN_PACKAGES = frozenset(
    {
        "braces",
        "eslint-config-next",
        "@next/eslint-plugin-next",
        "fast-glob",
        "micromatch",
    }
)

VITEST_DEV_TOOLCHAIN_PACKAGES = frozenset(
    {
        "vitest",
        "tinypool",
        "@vitest/mocker",
    }
)

DEFAULT_ACCEPTED_RISKS: dict[str, dict[str, Any]] = {
    "braces-dev-chain": {
        "enabled": True,
        "packages": sorted(BRACES_DEV_CHAIN_PACKAGES),
        "description": "Phase 1 dev-only eslint-config-next / braces chain (non-production)",
    },
    "vitest-dev-toolchain": {
        "enabled": False,
        "packages": sorted(VITEST_DEV_TOOLCHAIN_PACKAGES),
        "description": "Vitest/tinypool dev test tooling (enable only after documented acceptance)",
    },
}


def load_accepted_risk_config(repo_root: Path) -> dict[str, dict[str, Any]]:
    path = repo_root / "scripts" / "audit" / "accepted_dependency_risks.json"
    if not path.exists():
        return dict(DEFAULT_ACCEPTED_RISKS)
    data = json.loads(path.read_text(encoding="utf-8"))
    merged = dict(DEFAULT_ACCEPTED_RISKS)
    for key, entry in data.items():
        if isinstance(entry, dict):
            merged[key] = {**merged.get(key, {}), **entry}
    return merged


def _severity_rank(severity: str) -> int:
    return SEVERITY_ORDER.index(severity) if severity in SEVERITY_ORDER else -1


def _max_severity(packages: list[dict[str, str]]) -> str:
    if not packages:
        return "none"
    return max(packages, key=lambda p: _severity_rank(p.get("severity", "low")))["severity"]


def _risk_is_active(risk_id: str, entry: dict[str, Any]) -> bool:
    if not entry.get("enabled"):
        return False
    if risk_id == "vitest-dev-toolchain":
        return bool(entry.get("owner_explicit_acceptance"))
    return True


def _packages_for_risk(
    risk_id: str,
    config: dict[str, dict[str, Any]],
    vulnerable_names: set[str],
) -> set[str]:
    entry = config.get(risk_id) or {}
    if not _risk_is_active(risk_id, entry):
        return set()
    allowed = set(entry.get("packages") or [])
    return vulnerable_names & allowed


def evaluate_frontend_npm_audit(
    audit_info: dict[str, Any],
    config: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    counts = audit_info.get("counts") or {}
    total = sum(int(v) for v in counts.values())
    packages: list[dict[str, str]] = list(audit_info.get("all_packages") or [])
    if not packages and audit_info.get("packages"):
        packages = [
            {"name": p["name"], "severity": p.get("severity", "unknown")}
            for p in audit_info["packages"]
        ]
    vulnerable_names = {p["name"] for p in packages}

    if total == 0 and not vulnerable_names:
        return {
            "status": "pass",
            "blocking": False,
            "severity": "none",
            "accepted_risks": [],
            "unaccepted_package_names": [],
        }

    cfg = config or DEFAULT_ACCEPTED_RISKS
    covered: set[str] = set()
    accepted_risks: list[dict[str, Any]] = []

    for risk_id in ("braces-dev-chain", "vitest-dev-toolchain"):
        names = _packages_for_risk(risk_id, cfg, vulnerable_names)
        if not names:
            continue
        pkgs = [p for p in packages if p["name"] in names]
        covered |= names
        accepted_risks.append(
            {
                "id": risk_id,
                "status": "ACCEPTED_RISK",
                "severity": _max_severity(pkgs),
                "packages": sorted(names),
                "description": (cfg.get(risk_id) or {}).get("description", ""),
            }
        )

    unaccepted = vulnerable_names - covered
    unaccepted_packages = [p for p in packages if p["name"] in unaccepted]
    unaccepted_counts = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
    for p in unaccepted_packages:
        sev = p.get("severity", "low")
        if sev in unaccepted_counts:
            unaccepted_counts[sev] += 1

    blocking = unaccepted_counts["critical"] > 0 or unaccepted_counts["high"] > 0
    severity = _max_severity(unaccepted_packages) if unaccepted_packages else _max_severity(packages)

    return {
        "status": "fail" if total > 0 else "pass",
        "blocking": blocking,
        "severity": severity if unaccepted_packages else _max_severity(packages),
        "accepted_risks": accepted_risks,
        "unaccepted_package_names": sorted(unaccepted),
        "unaccepted_counts": unaccepted_counts,
    }


def apply_frontend_npm_policy_to_check(check: dict[str, Any], repo_root: Path) -> dict[str, Any]:
    if check.get("check") != "frontend-npm-audit":
        return check
    info = check.get("npm_audit") or {}
    if not info.get("available"):
        return check
    config = load_accepted_risk_config(repo_root)
    policy = evaluate_frontend_npm_audit(info, config)
    updated = dict(check)
    if policy["status"] == "pass":
        return updated
    updated["blocking"] = policy["blocking"]
    updated["accepted_risks"] = policy["accepted_risks"]
    updated["unaccepted_package_names"] = policy["unaccepted_package_names"]
    if policy["accepted_risks"] and not policy["blocking"]:
        updated["failure_type"] = "accepted_dependency_risk"
        updated["action_hint"] = (
            "Remaining advisories are covered by explicit ACCEPTED_RISK entries; "
            "unaccepted packages must not be present."
        )
    elif policy["blocking"]:
        updated["failure_type"] = "dependency_vulnerability"
        updated["action_hint"] = (
            f"Unaccepted vulnerable packages: {', '.join(policy['unaccepted_package_names'][:8])}"
        )
    if policy["severity"] in SEVERITY_ORDER:
        updated["severity"] = policy["severity"]
    if len(policy["accepted_risks"]) == 1:
        updated["accepted_risk"] = policy["accepted_risks"][0]["id"]
    elif policy["accepted_risks"]:
        updated["accepted_risk"] = ",".join(r["id"] for r in policy["accepted_risks"])
    return updated
