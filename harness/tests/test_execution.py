import copy
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.browser_report import validate_cases
from harness.jw_harness.execution import Execution
from harness.jw_harness.files import Json, Object, read_object, write_object
from harness.jw_harness.receipt import validate_journal


class ExecutionTests(unittest.TestCase):
    def test_no_execution_failure_and_old_results_cannot_pass(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
        ):
            root = Path(directory)
            write_object(root / "old.json", {"status": "pass"})
            os.utime(root / "old.json", (1, 1))
            empty = Execution(root, "empty.json", "checks")
            with self.assertRaises(ValueError):
                empty.finish([])
            failure = Execution(root, "failure.json", "checks")
            with self.assertRaises(subprocess.CalledProcessError):
                failure.run([sys.executable, "-c", "raise SystemExit(1)"])
            with self.assertRaises(ValueError):
                failure.finish([])
            stale = Execution(root, "stale.json", "checks")
            stale.run([sys.executable, "-c", "print('real execution')"])
            with self.assertRaisesRegex(ValueError, "not produced"):
                stale.finish(["old.json"])
            for file in ("empty.json", "failure.json", "stale.json"):
                self.assertEqual(read_object(root / file)["status"], "failed")

    def test_actual_execution_binds_fresh_output_and_rejects_modified_logs(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
        ):
            root = Path(directory)
            execution = Execution(root, "receipt.json", "checks")
            execution.run([sys.executable, "-c", "print('completed assertion fixture')"])
            write_object(root / "result.json", {"status": "pass"})
            execution.finish(["result.json"])
            validate_journal(root, "receipt.json", "fingerprint", "checks")
            with self.assertRaisesRegex(ValueError, "stale source"):
                validate_journal(root, "receipt.json", "different", "checks")
            (execution.directory / "000.log").write_text("changed")
            with self.assertRaisesRegex(ValueError, "log digest"):
                validate_journal(root, "receipt.json", "fingerprint", "checks")

    def test_source_change_invalidates_successful_commands(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch(
                "harness.jw_harness.execution.source_fingerprint", side_effect=["before", "after"]
            ),
        ):
            execution = Execution(Path(directory), "receipt.json", "checks")
            execution.run([sys.executable, "-c", "print('assertion completed')"])
            with self.assertRaisesRegex(ValueError, "Source changed"):
                execution.finish([])


class BrowserCasesTests(unittest.TestCase):
    def fixture(self) -> tuple[Object, Object, Object]:
        result: Object = {
            "projectName": "chromium-desktop",
            "status": "expected",
            "results": [{"status": "passed"}],
        }
        spec: Object = {"file": "fixture.spec.ts", "title": "required case", "tests": [result]}
        report: Object = {
            "stats": {"expected": 1, "unexpected": 0, "flaky": 0, "skipped": 0},
            "errors": [],
            "suites": [{"specs": [spec]}],
        }
        contract: Object = {
            "cases": [
                {
                    "file": "fixture.spec.ts",
                    "title": "required case",
                    "project": "chromium-desktop",
                    "required": True,
                }
            ]
        }
        return report, contract, result

    def test_required_named_cases_not_just_statistics(self) -> None:
        report, contract, result = self.fixture()
        self.assertEqual(validate_cases(report, contract)["passed"], 1)
        mutations: tuple[tuple[str, Json], ...] = (
            ("projectName", "wrong-project"),
            ("status", "skipped"),
            ("results", []),
            ("results", [{"status": "passed"}] * 2),
        )
        for key, value in mutations:
            original = copy.deepcopy(result)
            result[key] = value
            with self.assertRaises(ValueError):
                validate_cases(report, contract)
            result.clear()
            result.update(original)

    def test_required_skip_and_missing_suite_are_rejected(self) -> None:
        report, contract, result = self.fixture()
        result.update({"status": "skipped", "results": [{"status": "skipped"}]})
        report["stats"] = {"expected": 1, "unexpected": 0, "flaky": 0, "skipped": 1}
        with self.assertRaises(ValueError):
            validate_cases(report, contract)
        report["suites"] = []
        with self.assertRaises(ValueError):
            validate_cases(report, contract)
