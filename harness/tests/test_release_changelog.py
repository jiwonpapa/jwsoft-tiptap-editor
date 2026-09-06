import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.release_changelog import changelog_entry
from harness.jw_harness.release_remote import release_notes


class ReleaseChangelogTests(unittest.TestCase):
    def test_exact_version_only_is_published_in_both_phases(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "CHANGELOG.md").write_text(
                "# Changelog\n## [1.0.1] - 2026-09-06\n### Fixed\n- Safe link text\n"
                "## [1.0.0] - 2026-09-05\n- Older change\n"
            )
            changes = changelog_entry(root, "v1.0.1")
            self.assertEqual(changes, "### Fixed\n- Safe link text")
            for phase in ("candidate", "final"):
                notes = release_notes("v1.0.1", "commit", "a" * 64, phase, changes)
                self.assertIn(changes, notes)
                self.assertNotIn("Older change", notes)
                self.assertIn(f"jw-editor-release:{phase}:", notes)

    def test_missing_empty_duplicate_and_undated_entries_fail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            heading = "## [1.0.0] - 2026-09-06\n- Changed\n"
            for text in (
                "",
                heading.replace("1.0.0", "1.0.1"),
                heading * 2,
                "## [1.0.0] - 2026-09-06\n### Fixed\n",
                "## [1.0.0]\n- Changed",
            ):
                with self.subTest(text=text):
                    (root / "CHANGELOG.md").write_text(text)
                    with self.assertRaises(ValueError):
                        changelog_entry(root, "v1.0.0")
