import unittest
from pathlib import Path

from npm_audit_policy import (
    BRACES_DEV_CHAIN_PACKAGES,
    evaluate_frontend_npm_audit,
    load_accepted_risk_config,
)


REPO_ROOT = Path(__file__).resolve().parents[3]


def audit_info(packages: list[tuple[str, str]], counts: dict[str, int] | None = None) -> dict:
    all_packages = [{"name": n, "severity": s} for n, s in packages]
    if counts is None:
        counts = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
        for _, s in packages:
            if s in counts:
                counts[s] += 1
    return {
        "available": True,
        "counts": counts,
        "all_packages": all_packages,
        "all_package_names": [n for n, _ in packages],
        "packages": all_packages,
    }


class NpmAuditPolicyTests(unittest.TestCase):
    def test_case_a_braces_chain_only_accepted_non_blocking(self) -> None:
        packages = [(n, "high") for n in sorted(BRACES_DEV_CHAIN_PACKAGES)]
        config = load_accepted_risk_config(REPO_ROOT)
        config["vitest-dev-toolchain"]["enabled"] = False
        policy = evaluate_frontend_npm_audit(audit_info(packages), config)
        self.assertFalse(policy["blocking"])
        self.assertEqual([r["id"] for r in policy["accepted_risks"]], ["braces-dev-chain"])
        self.assertEqual(policy["unaccepted_package_names"], [])

    def test_case_b_braces_and_tinypool_critical_blocks_without_vitest_acceptance(self) -> None:
        packages = [("braces", "high"), ("tinypool", "critical")]
        config = load_accepted_risk_config(REPO_ROOT)
        config["vitest-dev-toolchain"]["enabled"] = False
        policy = evaluate_frontend_npm_audit(
            audit_info(
                packages,
                counts={"critical": 1, "high": 1, "moderate": 0, "low": 0},
            ),
            config,
        )
        self.assertTrue(policy["blocking"])
        self.assertIn("tinypool", policy["unaccepted_package_names"])
        self.assertIn("braces-dev-chain", [r["id"] for r in policy["accepted_risks"]])

    def test_case_c_unknown_dev_package_not_auto_accepted(self) -> None:
        packages = [("braces", "high"), ("some-new-dev-lib", "high")]
        config = load_accepted_risk_config(REPO_ROOT)
        policy = evaluate_frontend_npm_audit(audit_info(packages), config)
        self.assertTrue(policy["blocking"])
        self.assertIn("some-new-dev-lib", policy["unaccepted_package_names"])

    def test_case_d_zero_vulnerabilities_pass(self) -> None:
        policy = evaluate_frontend_npm_audit(
            {
                "available": True,
                "counts": {"critical": 0, "high": 0, "moderate": 0, "low": 0},
                "all_packages": [],
                "all_package_names": [],
            }
        )
        self.assertEqual(policy["status"], "pass")
        self.assertFalse(policy["blocking"])

    def test_vitest_accepted_keeps_critical_severity_not_downgraded(self) -> None:
        packages = [("vitest", "critical"), ("tinypool", "critical")]
        config = load_accepted_risk_config(REPO_ROOT)
        config["vitest-dev-toolchain"]["enabled"] = True
        policy = evaluate_frontend_npm_audit(
            audit_info(
                packages,
                counts={"critical": 2, "high": 0, "moderate": 0, "low": 0},
            ),
            config,
        )
        self.assertFalse(policy["blocking"])
        vitest_risk = next(r for r in policy["accepted_risks"] if r["id"] == "vitest-dev-toolchain")
        self.assertEqual(vitest_risk["severity"], "critical")
        self.assertEqual(vitest_risk["status"], "ACCEPTED_RISK")


if __name__ == "__main__":
    unittest.main()
