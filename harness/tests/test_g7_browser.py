import copy
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from harness.jw_harness.files import ROOT, Object, object_value, read_object, write_object
from harness.jw_harness.g7_browser_report import validate_g7_execution, validate_g7_reports


class G7BrowserTests(unittest.TestCase):
    def fixture(self, root: Path) -> Object:
        contract = read_object(ROOT / "harness/contracts/g7-browser-execution.json")
        write_object(root / "harness/contracts/g7-browser-execution.json", contract)
        reports: Object = {}
        now = datetime.now(UTC).isoformat()
        for phase, cases in object_value(contract["phases"]).items():
            assert isinstance(cases, list)
            reports[phase] = f"{phase}.json"
            write_object(
                root / f"{phase}.json",
                {
                    "runId": "owned",
                    "status": "pass",
                    "cases": [
                        {"id": case, "status": "passed", "startedAt": now, "finishedAt": now}
                        for case in cases
                    ],
                },
            )
        return {"runId": "owned", "reports": reports}

    def test_missing_failed_duplicate_and_unowned_cases_never_pass(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = self.fixture(root)
            self.assertEqual(validate_g7_reports(root, data)["passed"], 11)
            path = root / "legacy.json"
            original = read_object(path)
            for kind in ("missing", "failed", "duplicate", "unowned"):
                changed = copy.deepcopy(original)
                cases = changed["cases"]
                assert isinstance(cases, list)
                if kind == "missing":
                    changed["cases"] = []
                elif kind == "failed":
                    object_value(cases[0])["status"] = "failed"
                elif kind == "duplicate":
                    changed["cases"] = cases * 2
                else:
                    changed["runId"] = "other"
                write_object(path, changed)
                with self.assertRaises(ValueError):
                    validate_g7_reports(root, data)

    def test_successful_json_without_actual_browser_and_http_commands_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = self.fixture(root)
            data["commands"] = [{"argv": ["true"]}]
            data["counts"] = validate_g7_reports(root, data)
            with self.assertRaisesRegex(ValueError, "phases were not executed"):
                validate_g7_execution(root, data)
