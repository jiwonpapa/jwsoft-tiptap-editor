import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.files import ROOT, write_object


class HostEntrypointTests(unittest.TestCase):
    def test_all_mutation_entrypoints_reject_an_unregistered_host(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            host = Path(directory) / "g7"
            (host / "config").mkdir(parents=True)
            (host / "storage/app").mkdir(parents=True)
            (host / "storage/app/g7_installed").touch()
            (host / ".env").write_text("APP_ENV=local\n")
            (host / "artisan").write_text("<?php touch(__DIR__.'/unexpected-write');")
            (host / "config/app.php").write_text("<?php return [];")
            artifact = Path(directory) / "fixture.zip"
            artifact.write_bytes(b"intentionally not a real archive; guard must run first")
            for dirty in (False, True):
                if dirty:
                    self.register_dirty(host)
                commands = [
                    [
                        "bash",
                        "scripts/g7-lifecycle-evidence.sh",
                        str(host),
                        str(artifact),
                        str(artifact),
                        "1",
                        "1",
                        "1",
                    ],
                    [
                        "bash",
                        "scripts/g7-github-lifecycle-evidence.sh",
                        str(host),
                        str(artifact),
                        "1",
                        "1",
                        "1",
                    ],
                    [
                        "php",
                        "tests/integration/g7_remote_plugin_action.php",
                        str(host),
                        "install-zip",
                        str(artifact),
                    ],
                    [
                        "php",
                        "tests/integration/g7_zip_install_test.php",
                        str(host),
                        str(artifact),
                        "0.1.1",
                    ],
                ]
                for argv in commands:
                    result = subprocess.run(  # noqa: S603 -- explicit test entrypoints
                        argv,
                        cwd=ROOT,
                        env={**os.environ, "HARNESS_PYTHON": sys.executable},
                        capture_output=True,
                        check=False,
                        timeout=15,
                    )
                    self.assertNotEqual(result.returncode, 0, argv)
                    self.assertFalse((host / "unexpected-write").exists())

    def register_dirty(self, host: Path) -> None:
        subprocess.run(["git", "init", "--quiet", str(host)], check=True)  # noqa: S603,S607
        write_object(
            host / ".jw-editor-harness.json",
            {
                "schemaVersion": 1,
                "owner": "jwsoft-tiptap-editor",
                "purpose": "dedicated-test",
            },
        )
