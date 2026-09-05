"""A complete transaction receipt is mandatory; standalone pass JSON is insufficient."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import TextIO, cast
from unittest.mock import patch

from harness.jw_harness.deploy_evidence import (
    finish_deployment,
    validate_deployment,
    verify_staging,
)
from harness.jw_harness.deploy_transaction import JW
from harness.jw_harness.execution import Execution
from harness.jw_harness.files import Object, hash_file, read_object, write_object
from harness.tests.test_deployment import FakeRemote, archive


class DeployEvidenceTests(unittest.TestCase):
    def command(self, argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        cast(TextIO, kwargs["stdout"]).write("fixture command completed\n")
        return subprocess.CompletedProcess(argv, 0)

    def fixture(
        self, root: Path, environment: str = "staging", staging: Object | None = None
    ) -> tuple[Execution, Path]:
        previous, current = archive(root, "0.1.0"), archive(root, "0.2.0")
        before = FakeRemote(root, previous, JW).state()
        after = FakeRemote(root, current, JW).state()
        execution = Execution(
            root, f"test-results/harness/deploy-{environment}.json", f"deploy-{environment}"
        )
        labels = [
            "remote-deploy-preflight.sh",
            "stage",
            "remote-deploy-apply.sh",
            "remote-editor-command.sh",
            "remote-editor-state.php",
            "smoke",
        ]
        for label in labels:
            file = root / "scripts" / label
            file.parent.mkdir(exist_ok=True)
            file.write_text(f"fixture for {label}")
            transport = (
                "ssh" if label.startswith("remote-") else {"stage": "rsync", "smoke": "curl"}[label]
            )
            execution.run([transport, "fixture", label], input_text=file.read_text(), label=label)
        values = {
            "DEPLOY_HOST": "test-host",
            "G7_REMOTE_ROOT": "/test-app",
            "DEPLOY_MODE": "update",
            "EXPECTED_APP_ENV": "testing",
            "SMOKE_URL": "https://example.invalid/up",
            "SAME_TARGET_PROMOTION_APPROVED": "1",
        }
        finish_deployment(
            execution, environment, current, values, {"before": before, "after": after}, staging
        )
        return execution, current

    def test_standalone_pass_without_actual_receipt_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for env in ("staging", "production"):
                relative = f"test-results/deploy/{env}.json"
                write_object(root / relative, {"status": "pass", "environment": env})
                with self.assertRaises((ValueError, FileNotFoundError)):
                    validate_deployment(root, relative, "fingerprint")

    def test_transaction_result_logs_state_and_scripts_are_all_required(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.execution.subprocess.run", side_effect=self.command),
        ):
            root = Path(directory)
            execution, current = self.fixture(root)
            relative = "test-results/deploy/staging.json"
            validate_deployment(root, relative, "fingerprint")
            journal = read_object(execution.receipt)
            for missing in range(6):
                changed = json.loads(json.dumps(journal))
                changed["commands"].pop(missing)
                write_object(execution.receipt, changed)
                with self.assertRaisesRegex(ValueError, "Missing executed"):
                    validate_deployment(root, relative, "fingerprint")
            write_object(execution.receipt, journal)
            (execution.directory / "after.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                validate_deployment(root, relative, "fingerprint")
            self.assertTrue(current.is_file())

    def test_same_target_approval_version_checksum_and_history_are_preserved(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.provenance.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.execution.subprocess.run", side_effect=self.command),
        ):
            root = Path(directory)
            _, current = self.fixture(root)
            for version, digest, approved in (
                ("0.3.0", hash_file(current), True),
                ("0.2.0", "f" * 64, True),
                ("0.2.0", hash_file(current), False),
            ):
                with self.assertRaises(ValueError):
                    verify_staging(root, version, digest, "test-host:/test-app", approved)
            staging = verify_staging(root, "0.2.0", hash_file(current), "test-host:/test-app", True)
            self.fixture(root, "production", staging)
            validate_deployment(root, "test-results/deploy/production.json", "fingerprint")
            self.fixture(root)
            self.assertEqual(len(list((root / "test-results/deploy/history").iterdir())), 1)

    def test_transaction_failure_cannot_finish_a_successful_receipt(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.execution.source_fingerprint", return_value="fingerprint"),
            patch("harness.jw_harness.execution.subprocess.run", side_effect=self.command),
        ):
            root = Path(directory)
            execution, _ = self.fixture(root)
            execution.fail()
            with self.assertRaises(ValueError):
                validate_deployment(root, "test-results/deploy/staging.json", "fingerprint")
