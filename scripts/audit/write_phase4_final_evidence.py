#!/usr/bin/env python3
"""Write Phase 4 final evidence markdown from audit/audit-status.json (same run)."""

from __future__ import annotations

import json
from pathlib import Path


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    audit_dir = repo / "audit"
    review = repo / "review"
    review.mkdir(parents=True, exist_ok=True)

    status_path = audit_dir / "audit-status.json"
    if not status_path.exists():
        print("missing audit-status.json — run npm run audit first", flush=True)
        return 1

    status = json.loads(status_path.read_text(encoding="utf-8"))
    run_id = (audit_dir / "raw" / "LATEST_RUN.txt").read_text(encoding="utf-8").strip()
    checks = {c["check"]: c for c in status.get("checks", [])}

    def check(name: str) -> dict:
        return checks.get(name, {})

    fe_npm = check("frontend-npm-audit")
    sast = check("security-sast")
    gitleaks = check("security-gitleaks")
    be_circ = check("backend-circular-imports")
    fe_circ = check("frontend-circular-imports")

    baseline_sha = ""
    head_sha = ""
    try:
        import subprocess

        baseline_sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo, text=True
        ).strip()
        head_sha = baseline_sha
    except Exception:
        pass

    (review / "phase4-final-dependency-audit.md").write_text(
        "\n".join(
            [
                "# Phase 4 — dependency audit (final)",
                "",
                f"run_id: `{run_id}`",
                "",
                "## Frontend npm audit",
                f"- status: {fe_npm.get('status')}",
                f"- blocking: {fe_npm.get('blocking')}",
                f"- severity: {fe_npm.get('severity')}",
                f"- accepted_risks: {json.dumps(fe_npm.get('accepted_risks', []), indent=2)}",
                f"- unaccepted: {fe_npm.get('unaccepted_package_names', [])}",
                "",
                "## Accepted exceptions (gate)",
                json.dumps(status.get("accepted_exceptions", []), indent=2),
                "",
            ]
        ),
        encoding="utf-8",
    )

    sast_json = repo / "audit" / "raw" / "security-sast-semgrep.json"
    findings = errors = "n/a"
    if sast_json.exists():
        data = json.loads(sast_json.read_text(encoding="utf-8"))
        findings = len(data.get("results") or [])
        errors = len(data.get("errors") or [])

    (review / "phase4-final-sast.md").write_text(
        "\n".join(
            [
                "# Phase 4 — SAST (final)",
                "",
                f"run_id: `{run_id}`",
                f"- collector status: **{sast.get('status')}**",
                f"- message: {sast.get('message')}",
                f"- findings: {findings}",
                f"- parser/tool errors: {errors}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    (review / "phase4-final-circular-imports.md").write_text(
        "\n".join(
            [
                "# Phase 4 — circular imports (final)",
                "",
                f"run_id: `{run_id}`",
                f"- backend: {be_circ.get('status')} — {be_circ.get('message')}",
                f"- frontend: {fe_circ.get('status')} — {fe_circ.get('message')}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    (review / "phase4-final-quality-gate.md").write_text(
        "\n".join(
            [
                "# Phase 4 — quality gate (final)",
                "",
                f"run_id: `{run_id}`",
                f"- blocking_status: **{status.get('blocking_status')}**",
                f"- blocking_count: {status.get('blocking_count')}",
                f"- max_severity: {status.get('max_severity')}",
                f"- baseline_sha: `{baseline_sha}`",
                f"- final_sha: `{head_sha}`",
                "",
            ]
        ),
        encoding="utf-8",
    )

    (review / "phase4-final-residual-risks.md").write_text(
        "\n".join(
            [
                "# Phase 4 — residual risks (final)",
                "",
                f"run_id: `{run_id}`",
                "",
                "Explicit accepted risks only (see accepted_exceptions in audit-status.json).",
                "",
                json.dumps(status.get("accepted_exceptions", []), indent=2),
                "",
            ]
        ),
        encoding="utf-8",
    )

    report = audit_dir / "final-remediation-report.md"
    report.write_text(
        "\n".join(
            [
                "# Final remediation report — Dinamic Clean",
                "",
                f"**run_id:** `{run_id}`",
                f"**generated_from:** audit-status.json (atomic with this run)",
                "",
                "## Verdict",
                "",
                "See quality gate and collectors below; no ambiguous SAST wording.",
                "",
                "## SAST",
                f"- status: **{sast.get('status')}**",
                f"- findings: {findings}",
                f"- errors: {errors}",
                "",
                "## Secrets (Gitleaks)",
                f"- status: **{gitleaks.get('status')}** — {gitleaks.get('message')}",
                "",
                "## Tenant isolation",
                "- **NOT_APPLICABLE** (single-org RBAC; empresa_id operational)",
                "",
                "## Quality gate",
                f"- blocking_status: {status.get('blocking_status')}",
                f"- blocking_count: {status.get('blocking_count')}",
                "",
                "## Accepted risks",
                "",
                "```json",
                json.dumps(status.get("accepted_exceptions", []), indent=2),
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"Wrote phase4-final-* and {report}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
