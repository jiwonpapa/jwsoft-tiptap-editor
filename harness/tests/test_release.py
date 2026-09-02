import json
import tempfile
import unittest
from collections.abc import Callable, Sequence
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.files import ROOT, Object, hash_file, object_value, read_object
from harness.jw_harness.quality import validate_ci_tag
from harness.jw_harness.release import (
    DEFERRED,
    publish_candidate,
    publish_stable,
    validate_final,
    validate_readiness,
)
from harness.jw_harness.release_remote import (
    create_candidate,
    promote_candidate,
    release_notes,
    release_title,
    verify_tags,
)


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
            return json.dumps(
                {
                    "isPrerelease": False,
                    "isDraft": False,
                    "name": release_title("v1.0.0", "candidate"),
                    "body": release_notes("v1.0.0", "commit", hash_file(artifact), "candidate"),
                }
            )
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
                    "harness.jw_harness.release_remote.run",
                    side_effect=remote_download_stub(artifact, matches, calls),
                ):
                    if matches:
                        promote_candidate(root, "v1.0.0", "commit", artifact, hash_file(artifact))
                    else:
                        with self.assertRaises(ValueError):
                            promote_candidate(
                                root, "v1.0.0", "commit", artifact, hash_file(artifact)
                            )
                edits = [call for call in calls if call[2] == "edit"]
                self.assertEqual(len(edits), 1 if matches else 0)
                self.assertFalse(any(call[2] == "create" for call in calls))

    def test_already_stable_release_is_not_overwritten(self) -> None:
        with patch(
            "harness.jw_harness.release_remote.run", return_value='{"isPrerelease":false}'
        ) as command:
            with self.assertRaises(ValueError):
                promote_candidate(ROOT, "v1.0.0", "commit", ROOT / "unused.zip", "a" * 64)
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
            for publish in (publish_stable, publish_candidate):
                with self.assertRaises(ValueError):
                    publish(ROOT, f"v{version}", apply=True, approval="")
            runner.assert_not_called()

    def test_workflow_has_no_stable_publishing_shortcut(self) -> None:
        workflow = (ROOT / ".github/workflows/release.yml").read_text()
        self.assertIn("contents: read", workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertNotIn("push:", workflow)
        self.assertNotIn("gh release create", workflow)
        self.assertNotIn("Publish stable tagged release", workflow)
        self.assertNotIn("--generate-notes", workflow)
        self.assertNotIn("--prerelease=false", workflow)
        self.assertNotIn("gh release edit", workflow)

    def test_candidate_is_exact_subset_not_stable(self) -> None:
        data = final_evidence()
        verified = data["verified"]
        assert isinstance(verified, list)
        data.update(
            {
                "phase": "candidate",
                "requiredCount": 57,
                "verifiedCount": 57,
                "deferredCount": 5,
                "verified": [item for item in verified if object_value(item)["id"] not in DEFERRED],
            }
        )
        validate_readiness(data, "1.0.0", "a" * 64, "candidate")
        with self.assertRaises(ValueError):
            validate_final(data, "1.0.0", "a" * 64)
        assert isinstance(data["verified"], list)
        data["verified"][0] = {"id": "invented.requirement"}
        with self.assertRaises(ValueError):
            validate_readiness(data, "1.0.0", "a" * 64, "candidate")

    def test_existing_release_cannot_be_recreated(self) -> None:
        with patch(
            "harness.jw_harness.release_remote.run", return_value='[{"tagName":"v1.0.0"}]'
        ) as runner:
            with self.assertRaises(ValueError):
                create_candidate(ROOT, "v1.0.0", "commit", ROOT / "unused.zip", "a" * 64)
            self.assertEqual(runner.call_count, 1)

    def test_tag_mismatch_blocks_all_writes(self) -> None:
        for replies in (["", "other refs/tags/v1.0.0"], ["v1.0.0", "", "other"]):
            with patch("harness.jw_harness.release_remote.run", side_effect=replies) as runner:
                with self.assertRaises(ValueError):
                    verify_tags(ROOT, "v1.0.0", "commit", create=True)
                self.assertFalse(any(call.args[0][1] == "push" for call in runner.call_args_list))

    def test_annotated_tag_uses_peeled_commit(self) -> None:
        with patch(
            "harness.jw_harness.release_remote.run",
            side_effect=[
                "v1.0.0",
                "tag-object refs/tags/v1.0.0\ncommit refs/tags/v1.0.0^{}",
                "commit",
            ],
        ) as runner:
            verify_tags(ROOT, "v1.0.0", "commit", create=False)
            self.assertEqual(runner.call_count, 3)

    def test_candidate_plan_does_not_publish(self) -> None:
        with (
            patch(
                "harness.jw_harness.release.publication_gate",
                return_value=(ROOT / "unused.zip", "a" * 64, "commit"),
            ),
            patch("harness.jw_harness.release.create_candidate") as publish,
        ):
            publish_candidate(ROOT, "v1.0.0", apply=False, approval="")
            publish.assert_not_called()

    def test_changed_candidate_marker_is_rejected(self) -> None:
        metadata = {
            "isPrerelease": False,
            "isDraft": False,
            "name": release_title("v1.0.0", "candidate"),
            "body": release_notes("v1.0.0", "other-commit", "a" * 64, "candidate"),
        }
        with patch(
            "harness.jw_harness.release_remote.run", return_value=json.dumps(metadata)
        ) as runner:
            with self.assertRaises(ValueError):
                promote_candidate(ROOT, "v1.0.0", "commit", ROOT / "unused.zip", "a" * 64)
            self.assertEqual(runner.call_count, 1)
