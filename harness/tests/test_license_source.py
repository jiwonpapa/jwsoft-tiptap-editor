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
    write_object(
        root / "policy/runtime-license-sources.json",
        {"schemaVersion": 1, "packages": {}},
    )
    return copied


class SourceLicenseTests(unittest.TestCase):
    def test_nested_dependency_uses_extractable_license_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = root / "node_modules/parent/node_modules/example/LICENSE"
            original.parent.mkdir(parents=True)
            original.write_text("Nested example license")
            copied = root / "licenses/npm/parent/_nested/example/LICENSE"
            copied.parent.mkdir(parents=True)
            copied.write_bytes(original.read_bytes())
            package: Object = {
                "name": "parent/node_modules/example",
                "version": "1.0.0",
                "license": "MIT",
            }
            write_object(
                root / "package-lock.json",
                {"packages": {"node_modules/parent/node_modules/example": package}},
            )
            write_object(
                root / "licenses/npm-manifest.json",
                {
                    "packages": [
                        {
                            **package,
                            "files": [
                                {
                                    "file": "licenses/npm/parent/_nested/example/LICENSE",
                                    "sha256": hash_file(copied),
                                }
                            ],
                        }
                    ]
                },
            )
            write_object(root / "composer.lock", {"packages": [package]})
            write_object(root / "licenses/composer-manifest.json", {"packages": [package]})
            write_object(
                root / "policy/runtime-license-sources.json",
                {"schemaVersion": 1, "packages": {}},
            )

            validate_source_licenses(root)

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

    def test_exact_approved_fallback_covers_an_upstream_package_omission(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copied = fixture(root)
            original = root / "node_modules/example/LICENSE"
            source = root / "licenses/sources/npm/example/1.0.0/LICENSE"
            source.parent.mkdir(parents=True)
            source.write_bytes(original.read_bytes())
            original.unlink()
            digest = hash_file(source)
            manifest = read_object(root / "licenses/npm-manifest.json")
            packages = manifest["packages"]
            assert isinstance(packages, list) and isinstance(packages[0], dict)
            packages[0]["files"] = [
                {
                    "file": "licenses/npm/example/LICENSE",
                    "sha256": digest,
                    "upstream": "https://github.com/example/project/blob/v1.0.0/LICENSE",
                }
            ]
            write_object(root / "licenses/npm-manifest.json", manifest)
            write_object(
                root / "policy/runtime-license-sources.json",
                {
                    "schemaVersion": 1,
                    "packages": {
                        "example": {
                            "version": "1.0.0",
                            "license": "MIT",
                            "file": "licenses/sources/npm/example/1.0.0/LICENSE",
                            "destination": "LICENSE",
                            "sha256": digest,
                            "upstream": "https://github.com/example/project/blob/v1.0.0/LICENSE",
                        }
                    },
                },
            )
            validate_source_licenses(root)
            copied.write_text("changed")
            with self.assertRaises(ValueError):
                validate_source_licenses(root)
