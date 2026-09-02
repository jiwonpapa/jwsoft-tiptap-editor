"""GitHub source archives must ship the same dependency notices as release ZIPs."""

from pathlib import Path

from .files import Object, hash_file, object_value, read_object, repository_file, string_value


def package_rows(path: Path) -> list[Object]:
    packages = read_object(path).get("packages")
    if not isinstance(packages, list) or not packages:
        raise ValueError("Dependency license package manifest is missing")
    return [object_value(package) for package in packages]


def validate_source_licenses(root: Path) -> None:
    lock = object_value(read_object(root / "package-lock.json")["packages"])
    expected = {
        name.removeprefix("node_modules/"): object_value(metadata)
        for name, metadata in lock.items()
        if name.startswith("node_modules/") and object_value(metadata).get("dev") is not True
    }
    packages = package_rows(root / "licenses/npm-manifest.json")
    names = [string_value(package.get("name")) for package in packages]
    if len(set(names)) != len(names) or set(names) != set(expected):
        raise ValueError("GitHub source license package list differs from npm lock")
    for package in packages:
        name = string_value(package["name"])
        if any(package.get(key) != expected[name].get(key) for key in ("version", "license")):
            raise ValueError("GitHub source license metadata differs from npm lock")
        files = package.get("files")
        if not isinstance(files, list) or not files:
            raise ValueError("GitHub source license files are missing")
        for item in files:
            entry = object_value(item)
            relative = string_value(entry.get("file"))
            if Path(relative).parent != Path("licenses/npm") / name:
                raise ValueError("Unexpected GitHub source license path")
            actual = hash_file(repository_file(root, relative))
            original = repository_file(root, f"node_modules/{name}/{Path(relative).name}")
            if actual != entry.get("sha256") or actual != hash_file(original):
                raise ValueError("GitHub source license bytes differ from original")
    composer = package_rows(root / "licenses/composer-manifest.json")
    locked = package_rows(root / "composer.lock")
    expected_composer = sorted(
        [{key: item[key] for key in ("name", "version", "license")} for item in locked],
        key=lambda item: string_value(item["name"]),
    )
    if composer != expected_composer:
        raise ValueError("GitHub source Composer license list differs from lock")
