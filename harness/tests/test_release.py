import tempfile
import unittest
from collections.abc import Callable, Sequence
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.files import ROOT, Object, hash_file, object_value, read_object
from harness.jw_harness.quality import validate_ci_tag
from harness.jw_harness.release import promote_candidate, publish_stable, validate_final


def final_evidence() -> Object:
    items = read_object(ROOT / "harness/contracts/stable-readiness.json")["items"]
    if not isinstance(items, list):
        raise ValueError("Missing acceptance contract")
    return {
        "phase": "final",
        "status": "pass",
        "pluginVersion": "1.0.0",
        "artifactSha256": "a" * 64,
        "totalCount": 62,
        "requiredCount": 62,
        "verifiedCount": 62,
        "remainingCount": 0,
        "deferredCount": 0,
        "cleanTree": True,
        "remaining": [],
        "globalBlockers": [],
        "verified": [{"id": object_value(item)["id"]} for item in items],
    }


def remote_download_stub(
    artifact: Path,
    matches: bool,
    calls: list[list[str]],
) -> Callable[..., str]:
    def command(argv: Sequence[str], cwd: Path, *, capture: bool = False) -> str:
        calls.append(list(argv))
        if argv[2] == "view":
            return '{"isPrerelease":true}'
        if argv[2] == "download":
            downloaded = Path(argv[-1]) / artifact.name
            downloaded.write_bytes(b"verified-package" if matches else b"wrong-package")
        return ""

    return command


class ReleaseTests(unittest.TestCase):
    def test_candidate_tag_must_match_the_package(self) -> None:
        with patch.dict("os.environ", {"GITHUB_REF": "refs/tags/v999.0.0"}):
            with self.assertRaises(ValueError):
                validate_ci_tag(ROOT)

    def test_remote_bytes_must_match_before_candidate_promotion(self) -> None:
        for matches in (False, True):
            with self.subTest(matches=matches), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                artifact = root / "jwsoft-tiptap-editor-1.0.0.zip"
                artifact.write_bytes(b"verified-package")
                calls: list[list[str]] = []

                with patch(
                    "harness.jw_harness.release.run",
                    side_effect=remote_download_stub(artifact, matches, calls),
                ):
                    if matches:
                        promote_candidate(root, "v1.0.0", artifact, hash_file(artifact))
                    else:
                        with self.assertRaises(ValueError):
                            promote_candidate(root, "v1.0.0", artifact, hash_file(artifact))
                edits = [call for call in calls if call[2] == "edit"]
                self.assertEqual(len(edits), 1 if matches else 0)
                self.assertFalse(any(call[2] == "create" for call in calls))

    def test_already_stable_release_is_not_overwritten(self) -> None:
        with patch(
            "harness.jw_harness.release.run", return_value='{"isPrerelease":false}'
        ) as command:
            with self.assertRaises(ValueError):
                promote_candidate(ROOT, "v1.0.0", ROOT / "unused.zip", "a" * 64)
            self.assertEqual(command.call_count, 1)

    def test_only_final_62_is_accepted(self) -> None:
        validate_final(final_evidence(), "1.0.0", "a" * 64)
        for count in (57, 60, 61):
            data = final_evidence()
            data["verifiedCount"] = count
            with self.assertRaises(ValueError):
                validate_final(data, "1.0.0", "a" * 64)

    def test_stale_version_digest_or_phase_is_rejected(self) -> None:
        for field, wrong in (
            ("pluginVersion", "0.1.0"),
            ("artifactSha256", "b" * 64),
            ("phase", "candidate"),
        ):
            data = final_evidence()
            data[field] = wrong
            with self.assertRaises(ValueError):
                validate_final(data, "1.0.0", "a" * 64)

    def test_duplicate_claims_and_missing_deployment_are_rejected(self) -> None:
        data = final_evidence()
        data["verified"] = [{"id": "editor.html"} for _ in range(62)]
        with self.assertRaises(ValueError):
            validate_final(data, "1.0.0", "a" * 64)

    def test_publication_needs_explicit_approval_before_any_command(self) -> None:
        version = read_object(ROOT / "package.json")["version"]
        with patch("harness.jw_harness.release.run") as runner:
            with self.assertRaises(ValueError):
                publish_stable(ROOT, f"v{version}", apply=True, approval="")
            runner.assert_not_called()

    def test_workflow_has_no_stable_publishing_shortcut(self) -> None:
        workflow = (ROOT / ".github/workflows/release.yml").read_text()
        self.assertIn("--prerelease", workflow)
        self.assertNotIn("Publish stable tagged release", workflow)
        self.assertNotIn("--generate-notes", workflow)
        self.assertNotIn("--prerelease=false", workflow)
        self.assertNotIn("gh release edit", workflow)
