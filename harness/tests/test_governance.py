"""Negative cases prove forbidden changes fail, not merely that today's tree passes."""

import unittest
from datetime import date

from harness.jw_harness.files import Object
from harness.jw_harness.governance import debt_errors, inspect_source


class GovernanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.policy: Object = {"files": {}, "legacyNode": {}}

    def test_small_python_is_allowed(self) -> None:
        self.assertEqual(
            inspect_source("harness/jw_harness/example.py", "value = 1\n", self.policy), []
        )

    def test_large_python_is_rejected(self) -> None:
        errors = inspect_source("harness/jw_harness/example.py", "value = 1\n" * 301, self.policy)
        self.assertTrue(any("300 lines" in error for error in errors))

    def test_new_javascript_harness_is_rejected(self) -> None:
        for prefix in ("scripts", "harness", "harness/nested"):
            for suffix in ("js", "mjs", "cjs", "ts", "tsx"):
                errors = inspect_source(
                    f"{prefix}/new-glue.{suffix}", "console.log(1);", self.policy
                )
                self.assertTrue(any("use Python" in error for error in errors))

    def test_root_and_other_first_party_files_are_scanned(self) -> None:
        from unittest.mock import patch

        from harness.jw_harness.files import ROOT
        from harness.jw_harness.governance import check

        with patch("harness.jw_harness.governance.tracked_inputs", return_value=["plugin.php"]):
            with patch(
                "harness.jw_harness.governance.inspect_source", return_value=["sentinel"]
            ) as scan:
                with self.assertRaisesRegex(ValueError, "sentinel"):
                    check(ROOT)
                scan.assert_called_once()

    def test_ignored_type_errors_are_rejected(self) -> None:
        errors = inspect_source("resources/js/bad.ts", "// @ts-ignore\ncall();", self.policy)
        self.assertTrue(any("suppression" in error for error in errors))

    def test_shell_true_is_rejected(self) -> None:
        errors = inspect_source(
            "harness/jw_harness/bad.py", "run(command, shell=True)", self.policy
        )
        self.assertTrue(any("shell execution" in error for error in errors))

    def test_large_python_function_is_rejected(self) -> None:
        code = "def bad():\n" + "    value = 1\n" * 81
        errors = inspect_source("harness/jw_harness/bad.py", code, self.policy)
        self.assertTrue(any("Function exceeds" in error for error in errors))

    def test_debt_cannot_be_permanent_or_unowned(self) -> None:
        debt: Object = {
            "src/example.php": {
                "maxLines": 500,
                "owner": "maintainer",
                "reason": "split service",
                "expires": "2026-09-01",
            }
        }
        self.assertTrue(debt_errors(debt, date(2026, 9, 2)))
        with self.assertRaises(ValueError):
            debt_errors({"src/example.php": {"maxLines": 500}}, date(2026, 9, 2))
