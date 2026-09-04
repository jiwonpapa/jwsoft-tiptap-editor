import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.quality import audit_dependencies, check_all


class QualityTests(unittest.TestCase):
    def test_dependency_audit_uses_noninteractive_npm_json(self) -> None:
        root = Path("/audit-root")
        with (
            patch("harness.jw_harness.quality.run") as command,
            patch("harness.jw_harness.quality.audit_python") as python_audit,
        ):
            audit_dependencies(root)
        self.assertEqual(
            command.call_args_list[0].args,
            (["npm", "audit", "--json", "--audit-level=moderate"], root),
        )
        self.assertEqual(command.call_args_list[0].kwargs, {"capture": True})
        self.assertEqual(
            command.call_args_list[1].args,
            (["composer", "audit", "--locked", "--no-interaction"], root),
        )
        python_audit.assert_called_once_with(root)

    def test_failed_check_cannot_finish_receipt(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("harness.jw_harness.quality.Execution") as owner,
            patch("harness.jw_harness.quality.execute_checks", side_effect=ValueError("failed")),
        ):
            with self.assertRaises(ValueError):
                check_all(Path(directory))
            owner.return_value.finish.assert_not_called()
            owner.return_value.fail.assert_called_once()
