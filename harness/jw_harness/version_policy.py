"""Require a new plugin version whenever distributable files change."""

import json
import os
import re
from pathlib import Path

from .files import object_value, read_object, string_value
from .process import run
from .release_changelog import changelog_entry

DEPLOYABLE_FILES = {
    "CHANGELOG.md",
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "components.json",
    "composer.json",
    "composer.lock",
    "plugin.json",
    "plugin.php",
    "vendor-bundle.json",
    "vendor-bundle.zip",
}
DEPLOYABLE_DIRECTORIES = (
    "config/",
    "database/",
    "dist/",
    "lang/",
    "licenses/",
    "policy/",
    "resources/",
    "routes/",
    "src/",
)
VERSION_FILES = ("package.json", "package-lock.json", "plugin.json", "components.json")
SEMVER = re.compile(
    r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
)


def version_parts(version: str) -> tuple[int, int, int, tuple[tuple[int, int | str], ...]]:
    match = SEMVER.fullmatch(version)
    if match is None:
        raise ValueError(f"Invalid plugin SemVer: {version}")
    prerelease = match.group(4)
    identifiers: tuple[tuple[int, int | str], ...] = ()
    if prerelease is not None:
        identifiers = tuple(
            (0, int(item)) if item.isdigit() else (1, item) for item in prerelease.split(".")
        )
    return int(match.group(1)), int(match.group(2)), int(match.group(3)), identifiers


def newer_than(current: str, previous: str) -> bool:
    current_parts = version_parts(current)
    previous_parts = version_parts(previous)
    current_core, previous_core = current_parts[:3], previous_parts[:3]
    if current_core != previous_core:
        return current_core > previous_core
    current_pre, previous_pre = current_parts[3], previous_parts[3]
    if not current_pre:
        return bool(previous_pre)
    if not previous_pre:
        return False
    return current_pre > previous_pre


def manifest_version(root: Path) -> str:
    package = read_object(root / "package.json")
    lock = read_object(root / "package-lock.json")
    lock_root = object_value(object_value(lock.get("packages")).get(""))
    versions = {
        "package.json": string_value(package.get("version")),
        "package-lock.json": string_value(lock.get("version")),
        "package-lock.json root": string_value(lock_root.get("version")),
        "plugin.json": string_value(read_object(root / "plugin.json").get("version")),
        "components.json": string_value(read_object(root / "components.json").get("version")),
    }
    if len(set(versions.values())) != 1:
        detail = ", ".join(f"{name}={value}" for name, value in versions.items())
        raise ValueError(f"Plugin version surfaces differ: {detail}")
    return versions["package.json"]


def comparison_base(root: Path) -> str:
    configured = os.environ.get("JW_VERSION_BASE", "").strip()
    if configured and set(configured) != {"0"}:
        run(["git", "rev-parse", "--verify", f"{configured}^{{commit}}"], root, capture=True)
        return configured
    return run(
        ["git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD"],
        root,
        capture=True,
    )


def base_version(root: Path, base: str) -> str:
    raw = run(["git", "show", f"{base}:package.json"], root, capture=True)
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Base package manifest is invalid")
    value = data.get("version")
    if not isinstance(value, str):
        raise ValueError("Base plugin version is missing")
    version_parts(value)
    return value


def deployable_changes(root: Path, base: str) -> list[str]:
    changed = run(["git", "diff", "--name-only", "-z", base, "--"], root, capture=True)
    untracked = run(["git", "ls-files", "--others", "--exclude-standard", "-z"], root, capture=True)
    paths = changed.split("\0")[:-1] + untracked.split("\0")[:-1]
    return sorted({path for path in paths if is_deployable(path)})


def is_deployable(path: str) -> bool:
    if path in DEPLOYABLE_FILES:
        return True
    if path.startswith("resources/") and path.endswith(".test.ts"):
        return False
    return path.startswith(DEPLOYABLE_DIRECTORIES)


def validate_version_policy(root: Path, *, base: str | None = None) -> None:
    current = manifest_version(root)
    resolved_base = base or comparison_base(root)
    previous = base_version(root, resolved_base)
    changed = deployable_changes(root, resolved_base)
    if not changed:
        return
    if not newer_than(current, previous):
        sample = ", ".join(changed[:5])
        raise ValueError(
            "Deployable files changed without a higher plugin version "
            f"({previous} -> {current}): {sample}"
        )
    changelog_entry(root, f"v{current}")
