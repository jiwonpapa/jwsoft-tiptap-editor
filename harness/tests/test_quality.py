import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from harness.jw_harness.quality import check_all, execute_checks


class QualityTests(unittest.TestCase):
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

    def test_version_policy_blocks_before_general_checks(self) -> None:
        with (
            patch("harness.jw_harness.quality.validate_ci_tag"),
            patch(
                "harness.jw_harness.quality.validate_version_policy",
                side_effect=ValueError("version bump required"),
            ) as version_policy,
            patch("harness.jw_harness.quality.check") as governance,
        ):
            owner = Mock()
            with self.assertRaisesRegex(ValueError, "version bump required"):
                execute_checks(Path("example"), owner)
            version_policy.assert_called_once()
            governance.assert_not_called()
            owner.run.assert_not_called()
