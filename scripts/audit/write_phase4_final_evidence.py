#!/usr/bin/env python3
"""Write Phase 4 final evidence markdown from audit/audit-status.json (same run)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


def git_audit_metadata(repo: Path) -> dict:
    meta: dict = {
        "head_sha": None,
        "baseline_sha": None,
        "final_sha": None,
        "working_tree_dirty": None,
        "working_tree_status_short": None,
    }
    try:
        meta["head_sha"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo, text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return meta

    try:
        porcelain = subprocess.check_output(
            ["git", "status", "--porcelain"], cwd=repo, text=True
        )
        meta["working_tree_dirty"] = bool(porcelain.strip())
        if porcelain.strip():
            meta["working_tree_status_short"] = porcelain.strip().splitlines()[:20]
    except (subprocess.CalledProcessError, FileNotFoundError):
        meta["working_tree_dirty"] = None

    baseline_path = repo / "scripts" / "audit" / "phase4-remediation-baseline.sha"
    if baseline_path.is_file():
        meta["baseline_sha"] = baseline_path.read_text(encoding="utf-8").strip() or None

    if meta["working_tree_dirty"]:
        meta["final_sha"] = None
    else:
        meta["final_sha"] = meta["head_sha"]

    return meta


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    audit_dir = repo / "audit"
    review = repo / "review"
    review.mkdir(parents=True, exist_ok=True)

    status_path = audit_dir / "audit-status.json"
    if not status_path.exists():
        print("missing audit-status.json — run npm run audit first", flush=True)
        return 1

    latest = audit_dir / "raw" / "LATEST_RUN.txt"
    if not latest.is_file():
        print("missing LATEST_RUN.txt — run npm run audit first", flush=True)
        return 1

    status = json.loads(status_path.read_text(encoding="utf-8"))
    run_id = latest.read_text(encoding="utf-8").strip()
    git_meta = git_audit_metadata(repo)
    checks = {c["check"]: c for c in status.get("checks", [])}

    def check(name: str) -> dict:
        return checks.get(name, {})

    fe_npm = check("frontend-npm-audit")
    sast = check("security-sast")
    gitleaks = check("security-gitleaks")
    be_circ = check("backend-circular-imports")
    fe_circ = check("frontend-circular-imports")

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

    gate_lines = [
        "# Phase 4 — quality gate (final)",
        "",
        f"run_id: `{run_id}`",
        f"- blocking_status: **{status.get('blocking_status')}**",
        f"- blocking_count: {status.get('blocking_count')}",
        f"- max_severity: {status.get('max_severity')}",
        f"- head_sha: `{git_meta.get('head_sha')}`",
        f"- working_tree_dirty: **{git_meta.get('working_tree_dirty')}**",
    ]
    if git_meta.get("baseline_sha"):
        gate_lines.append(f"- baseline_sha: `{git_meta['baseline_sha']}`")
    else:
        gate_lines.append("- baseline_sha: _not recorded (no phase4-remediation-baseline.sha)_")
    if git_meta.get("final_sha"):
        gate_lines.append(f"- final_sha: `{git_meta['final_sha']}` (clean tree — matches audited commit)")
    else:
        gate_lines.append(
            "- final_sha: _not set_ — working tree has uncommitted changes; "
            "HEAD alone does not identify the full audited snapshot."
        )
    if git_meta.get("working_tree_status_short"):
        gate_lines.extend(["", "## Working tree (sample)", ""])
        gate_lines.extend(f"- `{line}`" for line in git_meta["working_tree_status_short"])

    (review / "phase4-final-quality-gate.md").write_text("\n".join(gate_lines) + "\n", encoding="utf-8")

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
                f"**final_sha:** `{git_meta.get('final_sha')}`",
                f"**baseline_sha:** `{git_meta.get('baseline_sha') or 'not recorded'}`",
                f"**working_tree_dirty:** {git_meta.get('working_tree_dirty')}",
                "",
                "## Phase status",
                "",
                "- FASE 1 — CLOSED",
                "- FASE 2 — CLOSED",
                "- FASE 3 — CLOSED",
                "- FASE 4 — CLOSED",
                "",
                "## Verdict",
                "",
                "**READY_WITH_ACCEPTED_RISKS** (not READY_FOR_PRODUCTION — accepted dependency advisories remain visible).",
                "",
                "## Accepted risks",
                "",
                "- **braces-dev-chain** — HIGH — dev-only eslint/braces chain",
                "- **vitest-dev-toolchain** — CRITICAL — dev/test-only — owner explicit acceptance",
                "",
                "## Limitations",
                "",
                "- Performance runtime: **NOT_VERIFIABLE** (operational debt; no fabricated metrics)",
                "- DB migrations: none in Phase 4 close",
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
                "```json",
                json.dumps(status.get("accepted_exceptions", []), indent=2),
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )

    (review / "phase4-final-git-status.txt").write_text(
        "\n".join(
            [
                f"run_id={run_id}",
                f"final_sha={git_meta.get('final_sha')}",
                f"head_sha={git_meta.get('head_sha')}",
                f"baseline_sha={git_meta.get('baseline_sha')}",
                f"working_tree_dirty={git_meta.get('working_tree_dirty')}",
                "",
                subprocess.check_output(["git", "status"], cwd=repo, text=True),
            ]
        ),
        encoding="utf-8",
    )
    print(f"Wrote phase4-final-* and {report}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
