import tempfile
import unittest
from pathlib import Path

from harness.jw_harness.files import Object, hash_file, read_object, write_object
from harness.jw_harness.license_source import validate_source_licenses


def fixture(root: Path) -> Path:
    original = root / "node_modules/example/LICENSE"
    original.parent.mkdir(parents=True)
    original.write_text("Example license")
    copied = root / "licenses/npm/example/LICENSE"
    copied.parent.mkdir(parents=True)
    copied.write_bytes(original.read_bytes())
    package: Object = {"name": "example", "version": "1.0.0", "license": "MIT"}
    write_object(root / "package-lock.json", {"packages": {"node_modules/example": package}})
    write_object(
        root / "licenses/npm-manifest.json",
        {
            "packages": [
                {
                    **package,
                    "files": [
                        {"file": "licenses/npm/example/LICENSE", "sha256": hash_file(copied)}
                    ],
                }
            ]
        },
    )
    write_object(root / "composer.lock", {"packages": [package]})
    write_object(root / "licenses/composer-manifest.json", {"packages": [package]})
    return copied


class SourceLicenseTests(unittest.TestCase):
    def test_current_source_passes_but_missing_or_changed_license_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copied = fixture(root)
            validate_source_licenses(root)
            copied.write_text("changed")
            with self.assertRaises(ValueError):
                validate_source_licenses(root)
            copied.unlink()
            with self.assertRaises(FileNotFoundError):
                validate_source_licenses(root)

    def test_manifest_cannot_omit_a_dependency(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture(root)
            write_object(root / "licenses/npm-manifest.json", {"packages": []})
            with self.assertRaises(ValueError):
                validate_source_licenses(root)

    def test_manifest_hash_cannot_legitimize_changed_original_text(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copied = fixture(root)
            copied.write_text("changed")
            manifest = read_object(root / "licenses/npm-manifest.json")
            packages = manifest["packages"]
            assert isinstance(packages, list) and isinstance(packages[0], dict)
            packages[0]["files"] = [
                {"file": "licenses/npm/example/LICENSE", "sha256": hash_file(copied)}
            ]
            write_object(root / "licenses/npm-manifest.json", manifest)
            with self.assertRaises(ValueError):
                validate_source_licenses(root)
