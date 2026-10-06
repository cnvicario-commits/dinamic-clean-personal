"""Tests for line-length readability collector."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import collectors.line_length_check as llc  # noqa: E402
from collectors.line_length_check import (  # noqa: E402
    classify_line,
    inevitable_content,
    scan,
    severity_for,
)

CONFIG = Path(__file__).resolve().parents[2] / "config" / "line-length.json"
COLLECTOR = Path(__file__).resolve().parents[1] / "line_length_check.py"


class TestLineLengthHelpers(unittest.TestCase):
    def test_severity_thresholds(self) -> None:
        t = {"warning": 120, "high": 160, "severe": 200}
        self.assertIsNone(severity_for(120, t))
        self.assertEqual(severity_for(121, t), "warning")
        self.assertEqual(severity_for(161, t), "high")
        self.assertEqual(severity_for(201, t), "severe")

    def test_classify_import(self) -> None:
        line = "import { somethingVeryLongName } from './path/to/module/that/makes/line/long'"
        cat, kind = classify_line(line, "src/foo.ts")
        self.assertEqual(cat, "import_export")
        self.assertEqual(kind, "structural")

    def test_inevitable_url(self) -> None:
        url = "https://example.com/" + "a" * 200
        self.assertTrue(inevitable_content(url, url))


class TestLineLengthScan(unittest.TestCase):
    def test_scan_finds_long_line_in_temp_tree(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            api = root / "apps" / "api" / "src"
            api.mkdir(parents=True)
            long_line = "export const value = '" + "x" * 130 + "';"
            (api / "sample.ts").write_text(f"// ok\n{long_line}\n", encoding="utf-8")
            cfg = {
                "enabled": True,
                "audit_thresholds": {"warning": 120, "high": 160, "severe": 200},
                "include_globs": ["apps/api/src/**/*.ts"],
                "exclude_globs": [],
                "snippet_max_chars": 80,
                "max_findings_in_json": 100,
            }
            with mock.patch.object(llc, "REPO_ROOT", root):
                report = scan(cfg)
            self.assertEqual(report["status"], "FINDINGS")
            self.assertGreaterEqual(report["totals"]["over_warning"], 1)

        proc = subprocess.run(
            [sys.executable, str(COLLECTOR)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertIn(proc.returncode, (0, 1))
        self.assertIn("STATUS:", proc.stdout)

    def test_config_has_audit_thresholds(self) -> None:
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
        self.assertTrue(cfg.get("enabled"))
        self.assertEqual(cfg["audit_thresholds"]["warning"], 120)
        self.assertEqual(cfg["audit_thresholds"]["high"], 160)
        self.assertEqual(cfg["audit_thresholds"]["severe"], 200)


if __name__ == "__main__":
    unittest.main()
