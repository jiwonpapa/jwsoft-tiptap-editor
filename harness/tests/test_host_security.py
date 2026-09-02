import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from harness.jw_harness.files import write_object
from harness.jw_harness.host import validate_host
from harness.jw_harness.security import contains_secret


class HostSecurityTests(unittest.TestCase):
    def test_unmarked_checkout_cannot_run_integration(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            host = root / "g7"
            host.mkdir()
            with patch("harness.jw_harness.host.run") as command:
                with self.assertRaises(OSError):
                    validate_host(root, host)
                command.assert_not_called()

    def test_clean_marked_checkout_is_allowed_but_dirty_is_not(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            host = root / "g7"
            (host / "config").mkdir(parents=True)
            (host / "artisan").touch()
            (host / "config/app.php").touch()
            write_object(
                host / ".jw-editor-harness.json",
                {
                    "schemaVersion": 1,
                    "owner": "jwsoft-tiptap-editor",
                    "purpose": "dedicated-test",
                },
            )
            with patch("harness.jw_harness.host.run", side_effect=[str(host.resolve()), ""]):
                validate_host(root, host)
            with patch(
                "harness.jw_harness.host.run", side_effect=[str(host.resolve()), " M app.php"]
            ):
                with self.assertRaises(ValueError):
                    validate_host(root, host)

    def test_product_root_cannot_be_registered_as_g7(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                validate_host(root, root)

    def test_secret_material_is_detected_without_logging_it(self) -> None:
        self.assertTrue(contains_secret("ghp_" + "x" * 36))
        self.assertTrue(contains_secret("-----BEGIN " + "PRIVATE KEY-----"))
        self.assertFalse(contains_secret("https://example.com/public-docs"))
