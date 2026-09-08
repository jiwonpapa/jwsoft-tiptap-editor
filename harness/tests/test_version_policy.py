import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.version_policy import newer_than, validate_version_policy


def command(root: Path, *args: str) -> None:
    subprocess.run(  # noqa: S603 -- fixed test-only Git commands without a shell
        args, cwd=root, check=True, capture_output=True
    )


def write_json(root: Path, name: str, data: object) -> None:
    (root / name).write_text(json.dumps(data) + "\n", encoding="utf-8")


def repository() -> tuple[tempfile.TemporaryDirectory[str], Path]:
    owner = tempfile.TemporaryDirectory()
    root = Path(owner.name)
    write_json(root, "package.json", {"version": "1.0.0"})
    write_json(
        root,
        "package-lock.json",
        {"version": "1.0.0", "packages": {"": {"version": "1.0.0"}}},
    )
    write_json(root, "plugin.json", {"version": "1.0.0"})
    write_json(root, "components.json", {"version": "1.0.0"})
    (root / "CHANGELOG.md").write_text(
        "# Changelog\n\n## [1.0.0] - 2026-09-08\n\n- Initial release\n",
        encoding="utf-8",
    )
    (root / "plugin.php").write_text("<?php // initial\n", encoding="utf-8")
    command(root, "git", "init", "-q")
    command(root, "git", "config", "user.email", "test@example.invalid")
    command(root, "git", "config", "user.name", "Version Policy Test")
    command(root, "git", "add", ".")
    command(root, "git", "commit", "-qm", "initial")
    return owner, root


def bump(root: Path, version: str, *, changelog: bool = True) -> None:
    write_json(root, "package.json", {"version": version})
    write_json(
        root,
        "package-lock.json",
        {"version": version, "packages": {"": {"version": version}}},
    )
    write_json(root, "plugin.json", {"version": version})
    write_json(root, "components.json", {"version": version})
    if changelog:
        old = (root / "CHANGELOG.md").read_text(encoding="utf-8")
        (root / "CHANGELOG.md").write_text(
            f"# Changelog\n\n## [{version}] - 2026-09-08\n\n- Changed runtime\n\n"
            + old.removeprefix("# Changelog\n\n"),
            encoding="utf-8",
        )


class VersionPolicyTests(unittest.TestCase):
    def test_ci_fetches_the_comparison_commit_and_runs_the_guard(self) -> None:
        workflow = (Path(__file__).parents[2] / ".github/workflows/ci.yml").read_text()
        self.assertIn("JW_VERSION_BASE:", workflow)
        self.assertIn("fetch-depth: 0", workflow)
        self.assertIn("run: make version-check", workflow)

    def test_semver_increase_supports_patch_minor_and_prerelease(self) -> None:
        self.assertTrue(newer_than("1.0.1", "1.0.0"))
        self.assertTrue(newer_than("1.1.0", "1.0.9"))
        self.assertTrue(newer_than("1.0.0", "1.0.0-rc.2"))
        self.assertTrue(newer_than("1.0.0-rc.2", "1.0.0-rc.1"))
        self.assertFalse(newer_than("1.0.0", "1.0.0"))

    def test_runtime_change_without_bump_is_blocked(self) -> None:
        owner, root = repository()
        with owner:
            (root / "plugin.php").write_text("<?php // changed\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "without a higher plugin version"):
                validate_version_policy(root, base="HEAD")

    def test_untracked_runtime_file_without_bump_is_blocked(self) -> None:
        owner, root = repository()
        with owner:
            path = root / "src/NewRuntime.php"
            path.parent.mkdir(parents=True)
            path.write_text("<?php\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "without a higher plugin version"):
                validate_version_policy(root, base="HEAD")

    def test_synced_bump_and_changelog_allow_runtime_change(self) -> None:
        owner, root = repository()
        with owner:
            (root / "plugin.php").write_text("<?php // changed\n", encoding="utf-8")
            bump(root, "1.0.1")
            validate_version_policy(root, base="HEAD")

    def test_missing_changelog_entry_is_blocked(self) -> None:
        owner, root = repository()
        with owner:
            (root / "plugin.php").write_text("<?php // changed\n", encoding="utf-8")
            bump(root, "1.0.1", changelog=False)
            with self.assertRaisesRegex(ValueError, "CHANGELOG"):
                validate_version_policy(root, base="HEAD")

    def test_harness_only_change_does_not_require_plugin_bump(self) -> None:
        owner, root = repository()
        with owner:
            path = root / "harness/tests/example.py"
            path.parent.mkdir(parents=True)
            path.write_text("# tooling only\n", encoding="utf-8")
            validate_version_policy(root, base="HEAD")

    def test_mismatched_version_surfaces_are_always_blocked(self) -> None:
        owner, root = repository()
        with owner:
            write_json(root, "plugin.json", {"version": "1.0.1"})
            with self.assertRaisesRegex(ValueError, "version surfaces differ"):
                validate_version_policy(root, base="HEAD")
