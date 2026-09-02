import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.deploy_transaction import JW
from harness.jw_harness.files import Object, hash_file
from harness.jw_harness.lifecycle import guarded_lifecycle, preserved
from harness.jw_harness.lifecycle_target import LifecycleTarget
from harness.tests.test_deployment import FakeRemote, archive


class FakeLifecycle(FakeRemote, LifecycleTarget):
    def content(self) -> Object:
        return {"records": {"page": "unchanged"}}

    def update(self, artifact: Path | None = None) -> None:
        if artifact is None:
            raise ValueError("Fixture requires an archive")
        self.apply(str(artifact), hash_file(artifact), "update")

    def install(self, source: Path | str, github: bool = False) -> Object:
        self.update(Path(source))
        return self.state()


class LifecycleTests(unittest.TestCase):
    def test_failed_downgrade_uninstall_or_switch_recovers_original_bytes_and_state(self) -> None:
        for step in ("downgrade", "uninstall", "switch"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                old, current = archive(root, "0.1.0"), archive(root, "0.1.1")
                target = FakeLifecycle(root, current, JW)
                initial = target.state()

                def failure(
                    target: FakeLifecycle = target,
                    old: Path = old,
                    step: str = step,
                ) -> Object:
                    target.update(old)
                    if step == "uninstall":
                        target.current.update({"jwInstalled": False, "jwActive": False})
                    if step == "switch":
                        target.current.update({"jwActive": False, "ckActive": True})
                    raise RuntimeError("Injected failure before verification")

                with self.assertRaisesRegex(RuntimeError, "restored; no pass"):
                    guarded_lifecycle(target, current, failure)
                self.assertEqual(target.state(), initial)

    def test_failed_recovery_is_critical_and_unverified_initial_state_never_mutates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old, current = archive(root, "0.1.0"), archive(root, "0.1.1")
            target = FakeLifecycle(root, current, JW)

            def failure() -> Object:
                target.update(old)
                target.recovery_failure = True
                raise RuntimeError("Injected failure")

            with self.assertRaisesRegex(RuntimeError, "CRITICAL"):
                guarded_lifecycle(target, current, failure)
            target = FakeLifecycle(root, current, JW)
            target.current["files"] = {}
            with self.assertRaises(ValueError):
                guarded_lifecycle(target, current, failure)
            self.assertEqual(target.calls, [])

    def test_all_upload_ledgers_and_content_must_be_preserved(self) -> None:
        for key in ("records", "imageUploadRows", "mediaUploadRows", "mediaSessionRows"):
            with self.assertRaises(ValueError):
                preserved({key: 1}, {key: 2})
        with self.assertRaises(ValueError):
            preserved({}, {"permissions": 0})
