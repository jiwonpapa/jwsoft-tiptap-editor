import copy
import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.deploy_entry import deploy_from_environment
from harness.jw_harness.deploy_transaction import CK, JW, archive_manifest, deploy_transaction
from harness.jw_harness.files import ROOT, Object, hash_file


def archive(root: Path, version: str) -> Path:
    path = root / ".build" / f"{JW}-{version}.zip"
    path.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(path, "w") as output:
        output.writestr(f"{JW}/plugin.json", json.dumps({"identifier": JW, "version": version}))
        output.writestr(f"{JW}/dist/js/plugin.iife.js", version)
    return path


class FakeRemote:
    def __init__(self, root: Path, previous: Path, active: str) -> None:
        self.project = root
        version, files = archive_manifest(previous)
        self.current: Object = {
            "jwVersion": version,
            "files": files,
            "jwInstalled": True,
            "jwActive": active == JW,
            "ckActive": active == CK,
        }
        self.calls: list[str] = []
        self.smoke_failures = 0
        self.activation_noop = False
        self.apply_failure = False
        self.recovery_failure = False

    def state(self) -> Object:
        return copy.deepcopy(self.current)

    def stage(self, artifact: Path) -> str:
        return str(artifact)

    def apply(self, artifact: str, digest: str, mode: str) -> None:
        self.calls.append(f"apply:{Path(artifact).name}")
        if (
            self.recovery_failure
            and len([call for call in self.calls if call.startswith("apply:")]) > 1
        ):
            raise RuntimeError("recovery injected failure")
        if hash_file(Path(artifact)) != digest:
            raise ValueError("checksum")
        version, files = archive_manifest(Path(artifact))
        self.current.update({"jwVersion": version, "files": files, "jwInstalled": True})
        if self.apply_failure and version == "0.2.0":
            raise RuntimeError("partial update failure")

    def command(self, action: str, plugin: str = "") -> None:
        self.calls.append(f"{action}:{plugin}")
        if action in ("plugin:activate", "plugin:deactivate"):
            if action == "plugin:activate" and self.activation_noop and plugin == JW:
                return
            self.current["jwActive" if plugin == JW else "ckActive"] = action == "plugin:activate"

    def smoke(self, url: str) -> None:
        self.calls.append("http-smoke")
        if self.smoke_failures:
            self.smoke_failures -= 1
            raise subprocess.TimeoutExpired("curl", 20)


class DeploymentTests(unittest.TestCase):
    def test_http_failure_restores_previous_bytes_and_each_prior_editor(self) -> None:
        for active in (JW, CK, "none"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                before, current = archive(root, "0.1.0"), archive(root, "0.2.0")
                remote = FakeRemote(root, before, active)
                original = remote.state()
                remote.smoke_failures = 1
                with self.assertRaisesRegex(RuntimeError, "restored; no pass"):
                    deploy_transaction(
                        remote, current, hash_file(current), "update", "https://example.test/up"
                    )
                self.assertEqual(remote.state(), original)
                self.assertEqual(remote.calls.count("http-smoke"), 2)

    def test_recovery_failure_is_reported_separately(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            before, current = archive(root, "0.1.0"), archive(root, "0.2.0")
            remote = FakeRemote(root, before, JW)
            remote.smoke_failures = 1
            remote.recovery_failure = True
            with self.assertRaisesRegex(RuntimeError, "CRITICAL"):
                deploy_transaction(
                    remote, current, hash_file(current), "update", "https://example.test/up"
                )

    def test_missing_or_modified_previous_archive_prevents_first_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            before, current = archive(root, "0.1.0"), archive(root, "0.2.0")
            remote = FakeRemote(root, before, JW)
            before.unlink()
            with self.assertRaises(FileNotFoundError):
                deploy_transaction(
                    remote, current, hash_file(current), "update", "https://example.test/up"
                )
            self.assertEqual(remote.calls, [])
            archive(root, "0.1.0")
            remote.current["files"] = {"plugin.json": "changed"}
            with self.assertRaisesRegex(ValueError, "files differ"):
                deploy_transaction(
                    remote, current, hash_file(current), "update", "https://example.test/up"
                )
            self.assertEqual(remote.calls, [])

    def test_partial_apply_and_noop_activation_are_not_success(self) -> None:
        for failure in ("apply_failure", "activation_noop"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                before, current = archive(root, "0.1.0"), archive(root, "0.2.0")
                remote = FakeRemote(root, before, CK)
                original = remote.state()
                setattr(remote, failure, True)
                with self.assertRaisesRegex(RuntimeError, "restored; no pass"):
                    deploy_transaction(
                        remote, current, hash_file(current), "update", "https://example.test/up"
                    )
                self.assertEqual(remote.state(), original)

    def test_success_and_already_active_editor_do_not_roll_back(self) -> None:
        for active in (JW, CK):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                before, current = archive(root, "0.1.0"), archive(root, "0.2.0")
                remote = FakeRemote(root, before, active)
                deploy_transaction(
                    remote, current, hash_file(current), "update", "https://example.test/up"
                )
                self.assertEqual(remote.current["jwVersion"], "0.2.0")
                self.assertIs(remote.current["jwActive"], True)
                self.assertIs(remote.current["ckActive"], False)
                self.assertEqual(remote.calls[-1], "http-smoke")

    def test_direct_entry_requires_apply_and_production_token(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            current = archive(root, "0.2.0")
            with self.assertRaises(ValueError):
                deploy_from_environment(root, "production", current, apply=False)
            values = {
                "DEPLOY_HOST": "example",
                "G7_REMOTE_ROOT": "/srv/example",
                "DEPLOY_MODE": "update",
                "SMOKE_URL": "https://example.test/up",
                "EXPECTED_APP_ENV": "production",
                "REMOTE_ARTIFACT_DIR": "/srv/example/stage",
            }
            with (
                patch.dict("os.environ", values, clear=True),
                patch("harness.jw_harness.deploy_entry.run") as command,
            ):
                with self.assertRaisesRegex(ValueError, "confirmation token"):
                    deploy_from_environment(root, "production", current, apply=True)
                command.assert_not_called()

    def test_shell_records_pass_only_after_guarded_transaction(self) -> None:
        shell = (ROOT / "scripts/deploy.sh").read_text()
        self.assertLess(
            shell.index("deploy-transaction"), shell.index('deploy-evidence.mjs" record')
        )
        self.assertNotIn("|| true", shell)
        self.assertIn('[ "$action" = "--apply" ]', shell)

    def test_failed_release_gate_prevents_any_remote_call(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            current = archive(root, "0.2.0")
            values = {
                "DEPLOY_HOST": "example",
                "G7_REMOTE_ROOT": "/srv/example",
                "DEPLOY_MODE": "update",
                "SMOKE_URL": "https://example.test/up",
                "EXPECTED_APP_ENV": "production",
                "REMOTE_ARTIFACT_DIR": "/srv/example/stage",
            }
            with (
                patch.dict("os.environ", values, clear=True),
                patch(
                    "harness.jw_harness.deploy_entry.run", side_effect=ValueError("gate blocked")
                ),
                patch("harness.jw_harness.deploy_entry.Remote") as remote,
            ):
                with self.assertRaisesRegex(ValueError, "gate blocked"):
                    deploy_from_environment(root, "staging", current, apply=True)
                remote.assert_not_called()

    def test_remote_shell_rejects_bad_digest_and_existing_pending_before_install(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = archive(root, "0.2.0")
            app = root / "app"
            app.mkdir()
            php = root / "fixture-php"
            php.write_text("#!/usr/bin/env bash\nset -eu\ntouch invoked\n")
            php.chmod(0o700)
            args = [
                "bash",
                str(ROOT / "scripts/remote-deploy-apply.sh"),
                str(app),
                str(php),
                "install",
                str(package),
            ]
            bad = subprocess.run([*args, "0" * 64], capture_output=True, check=False, timeout=10)  # noqa: S603
            self.assertNotEqual(bad.returncode, 0)
            self.assertFalse((app / "invoked").exists())
            pending = app / "plugins/_pending/jwsoft-tiptap-editor"
            pending.mkdir(parents=True)
            keep = pending / "user-owned"
            keep.write_text("preserve")
            conflict = subprocess.run(  # noqa: S603 -- fixed script and generated fixture paths
                [*args, hash_file(package)], capture_output=True, check=False, timeout=10
            )
            self.assertNotEqual(conflict.returncode, 0)
            self.assertEqual(keep.read_text(), "preserve")
            self.assertFalse((app / "invoked").exists())
            keep.unlink()
            pending.rmdir()
            success = subprocess.run(  # noqa: S603 -- fixed script and generated fixture paths
                [*args, hash_file(package)], capture_output=True, check=False, timeout=10
            )
            self.assertEqual(success.returncode, 0, success.stderr)
            self.assertTrue((app / "invoked").exists())
            self.assertTrue((pending / "plugin.json").is_file())
