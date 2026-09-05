"""Audit failures retain logs and cannot be promoted by a source/package-only result."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import TextIO, cast
from unittest.mock import patch

from harness.jw_harness.audit import AUDIT_INPUTS, AUDIT_RECEIPT, audit_dependencies
from harness.jw_harness.files import object_value, read_object, write_object
from harness.jw_harness.receipt import validate_artifact_execution


class AuditTests(unittest.TestCase):
    def fixture(self, root: Path) -> None:
        for relative in AUDIT_INPUTS:
            file = root / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("fixture lock")

    def command(self, argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        output = '{"metadata":{"vulnerabilities":{"moderate":0,"high":0,"critical":0}}}'
        if argv[0] == "composer":
            output = '{"advisories":[]}'
        cast(TextIO, kwargs["stdout"]).write(output)
        return subprocess.CompletedProcess(argv, 0)

    def test_only_executed_current_three_language_audit_is_accepted(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.execution.subprocess.run", side_effect=self.command),
        ):
            root = Path(directory)
            self.fixture(root)
            audit_dependencies(root)
            validate_artifact_execution(root, AUDIT_RECEIPT, "fingerprint")
            receipt = read_object(root / AUDIT_RECEIPT)
            for missing in (3, 4, 5):
                modified = json.loads(json.dumps(receipt))
                modified["commands"].pop(missing)
                write_object(root / AUDIT_RECEIPT, modified)
                with self.assertRaisesRegex(ValueError, "three dependency"):
                    validate_artifact_execution(root, AUDIT_RECEIPT, "fingerprint")
            write_object(root / AUDIT_RECEIPT, receipt)
            (root / "composer.lock").write_text("changed lock")
            with self.assertRaisesRegex(ValueError, "lockfile"):
                validate_artifact_execution(root, AUDIT_RECEIPT, "fingerprint")

    def test_registry_error_keeps_actual_log_and_never_passes(self) -> None:
        def failed(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            cast(TextIO, kwargs["stdout"]).write('{"error":{"code":"ETIMEDOUT"}}')
            return subprocess.CompletedProcess(argv, 1)

        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.execution.subprocess.run", side_effect=failed),
        ):
            root = Path(directory)
            self.fixture(root)
            with self.assertRaises(subprocess.CalledProcessError):
                audit_dependencies(root)
            receipt = read_object(root / AUDIT_RECEIPT)
            self.assertEqual(receipt["status"], "failed")
            commands = receipt["commands"]
            self.assertIsInstance(commands, list)
            if isinstance(commands, list):
                log = object_value(commands[0])["log"]
                self.assertIsInstance(log, str)
                if isinstance(log, str):
                    self.assertIn("ETIMEDOUT", (root / log).read_text())
            with self.assertRaises(ValueError):
                validate_artifact_execution(root, AUDIT_RECEIPT, "fingerprint")

    def test_pass_without_execution_or_malformed_success_is_rejected(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.execution.subprocess.run", side_effect=self.command),
            patch(
                "harness.jw_harness.audit.read_object", return_value={"error": "invalid success"}
            ),
        ):
            root = Path(directory)
            self.fixture(root)
            write_object(root / AUDIT_RECEIPT, {"status": "pass"})
            with self.assertRaises(ValueError):
                validate_artifact_execution(root, AUDIT_RECEIPT, "fingerprint")
            with self.assertRaises(ValueError):
                audit_dependencies(root)
            self.assertEqual(read_object(root / AUDIT_RECEIPT)["status"], "failed")
