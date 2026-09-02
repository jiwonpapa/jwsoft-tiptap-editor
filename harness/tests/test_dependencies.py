import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.dependencies import audit_python
from harness.jw_harness.files import Object


class DependencyTests(unittest.TestCase):
    def test_unpinned_empty_and_vulnerable_dependencies_fail(self) -> None:
        for content in ("", "ruff>=1.0.0\n", "ruff==1.0.0\n"):
            with self.subTest(content=content), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "harness").mkdir()
                (root / "harness/requirements-dev.txt").write_text(content)
                with self.assertRaises(ValueError):
                    audit_python(root, lambda name, version: {"vulnerabilities": [{"id": "test"}]})

    def test_missing_advisory_response_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "harness").mkdir()
            (root / "harness/requirements-dev.txt").write_text("ruff==1.0.0\n")
            with self.assertRaises(ValueError):
                audit_python(root, lambda name, version: {})

    def test_pinned_dependencies_with_no_advisories_pass(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "harness").mkdir()
            (root / "harness/requirements-dev.txt").write_text("ruff==1.0.0\n")
            clean: Object = {"vulnerabilities": []}
            self.assertEqual(audit_python(root, lambda name, version: clean), 1)
