import unittest
from unittest.mock import patch

from harness.jw_harness.files import ROOT
from harness.jw_harness.quality import check_all


class QualityTests(unittest.TestCase):
    def test_source_change_during_checks_cannot_be_stamped_as_pass(self) -> None:
        with (
            patch("harness.jw_harness.quality.check"),
            patch("harness.jw_harness.quality.check_secrets"),
            patch("harness.jw_harness.quality.tracked_inputs", return_value=[]),
            patch("harness.jw_harness.quality.source_fingerprint", side_effect=["before", "after"]),
            patch("harness.jw_harness.quality.run") as commands,
        ):
            with self.assertRaisesRegex(ValueError, "Source changed during checks"):
                check_all(ROOT)
            self.assertFalse(
                any("record-checks" in call.args[0] for call in commands.call_args_list)
            )
