#!/usr/bin/env python3
"""Evaluate Semgrep JSON output for audit status."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def evaluate(path: Path) -> tuple[str, int, int]:
    if not path.is_file() or path.stat().st_size == 0:
        return "error", 0, -1
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return "error", 0, -1
    findings = len(data.get("results") or [])
    errors = len(data.get("errors") or [])
    if findings > 0:
        return "findings", findings, errors
    if errors > 0:
        return "error", findings, errors
    return "pass", findings, errors


def main() -> int:
    path = Path(sys.argv[1])
    status, findings, errors = evaluate(path)
    print(f"{status}\t{findings}\t{errors}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
