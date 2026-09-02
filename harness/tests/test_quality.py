import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.quality import check_all


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
