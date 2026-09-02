import unittest
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.deploy_entry import deploy_from_environment
from harness.jw_harness.deploy_remote import Remote


class SmokeTests(unittest.TestCase):
    def test_direct_entry_rejects_non_http_before_any_gate_or_remote_call(self) -> None:
        values = {
            "DEPLOY_HOST": "example",
            "G7_REMOTE_ROOT": "/srv/example",
            "DEPLOY_MODE": "update",
            "EXPECTED_APP_ENV": "production",
            "REMOTE_ARTIFACT_DIR": "/srv/example/stage",
        }
        for url in (
            "file:///etc/passwd",
            "ftp://example.test/up",
            "--version",
            "https:///up",
            "https://user:password@example.test/up",
            "https://example.test/up\n",
            "https://example.test:99999/up",
        ):
            with (
                self.subTest(url=url),
                patch.dict("os.environ", {**values, "SMOKE_URL": url}, clear=True),
                patch("harness.jw_harness.deploy_entry.hash_file", return_value="0" * 64),
                patch(
                    "harness.jw_harness.deploy_entry.archive_manifest", return_value=("1.0.0", {})
                ),
                patch(
                    "harness.jw_harness.deploy_entry.run", side_effect=ValueError("gate reached")
                ) as command,
            ):
                with self.assertRaisesRegex(ValueError, "HTTP"):
                    deploy_from_environment(Path.cwd(), "staging", Path("unused.zip"), apply=True)
                command.assert_not_called()

    def test_curl_restricts_both_initial_and_redirect_protocols_and_ends_options(self) -> None:
        remote = Remote(Path.cwd(), "example", "/srv/example", "/srv/example/stage")
        with patch("harness.jw_harness.deploy_remote.run") as command:
            for url in ("https://example.test/up", "http://127.0.0.1:8765/up"):
                remote.smoke(url)
                argv = command.call_args.args[0]
                self.assertEqual(argv[-2:], ["--", url])
                self.assertEqual(argv[argv.index("--proto") + 1], "=http,https")
                self.assertEqual(argv[argv.index("--proto-redir") + 1], "=http,https")
            command.reset_mock()
            with self.assertRaisesRegex(ValueError, "HTTP"):
                remote.smoke("file:///etc/passwd")
            command.assert_not_called()
