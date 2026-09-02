import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.clean import clean_caches
from harness.jw_harness.evidence import record_observation, validate_browser_report
from harness.jw_harness.files import Object, read_object, repository_file, write_object


class EvidenceTests(unittest.TestCase):
    def test_manual_pass_is_still_unverified(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_object(root / "note.json", {"status": "pass", "saved": True})
            output = record_observation(root, "note.json")
            self.assertEqual(read_object(output)["status"], "unverified")

    def test_browser_failure_and_flakiness_are_rejected(self) -> None:
        for key in ("unexpected", "flaky"):
            report: Object = {
                "stats": {"expected": 4, "unexpected": 0, "flaky": 0, "skipped": 1},
                "errors": [],
            }
            stats = report["stats"]
            self.assertIsInstance(stats, dict)
            if isinstance(stats, dict):
                stats[key] = 1
            with self.assertRaises(ValueError):
                validate_browser_report(report)

    def test_empty_browser_suite_does_not_pass(self) -> None:
        with self.assertRaises(ValueError):
            validate_browser_report({"stats": {"expected": 0}, "errors": []})

    def test_skipped_tests_are_not_counted_as_passes(self) -> None:
        report: Object = {
            "stats": {"expected": 4, "unexpected": 0, "flaky": 0, "skipped": 2},
            "errors": [],
        }
        self.assertEqual(
            validate_browser_report(report), {"passed": 4, "skipped": 2, "failed": 0, "flaky": 0}
        )

    def test_clean_preserves_evidence_packages_and_hosts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in (".build", "test-results", ".harness", ".ruff_cache"):
                (root / name).mkdir()
            clean_caches(root)
            self.assertTrue((root / ".ruff_cache").exists())
            clean_caches(root, apply=True)
            self.assertFalse((root / ".ruff_cache").exists())
            for name in (".build", "test-results", ".harness"):
                self.assertTrue((root / name).is_dir())

    def test_symlink_and_traversal_cannot_escape(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            root.mkdir()
            target = Path(directory) / "outside.json"
            target.write_text("{}")
            (root / "link.json").symlink_to(target)
            for relative in ("link.json", "../outside.json", str(target)):
                with self.assertRaises(ValueError):
                    repository_file(root, relative)
            (root / ".ruff_cache").symlink_to(target.parent, target_is_directory=True)
            with self.assertRaises(ValueError):
                clean_caches(root, apply=True)
            self.assertTrue(target.exists())
