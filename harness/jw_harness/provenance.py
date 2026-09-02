"""One source fingerprint shared by Python orchestration and legacy Node adapters."""

import hashlib
from pathlib import Path

from .files import hash_file
from .process import tracked_inputs

SOURCE_DIRS = (
    "licenses/",
    "resources/",
    "src/",
    "routes/",
    "database/",
    "lang/",
    "config/",
    "policy/",
    "scripts/",
    "tests/",
    "harness/",
    ".github/",
)
SOURCE_FILES = {
    "NOTICE",
    "plugin.php",
    "plugin.json",
    "components.json",
    "composer.json",
    "composer.lock",
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "tsconfig.json",
    "Makefile",
    "CHANGELOG.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "vendor-bundle.json",
    "vendor-bundle.zip",
    "CONSTITUTION.md",
    "CONTRIBUTING.md",
    "AGENTS.md",
    "docs/13-engineering-standards.md",
    "pyproject.toml",
    "eslint.config.mjs",
    "phpstan.neon",
}


def source_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for relative in sorted(set(tracked_inputs(root))):
        if not relative.startswith(SOURCE_DIRS) and relative not in SOURCE_FILES:
            continue
        file = root / relative
        value = hash_file(file) if file.is_file() else "missing"
        digest.update(f"{relative}\0{value}\0".encode())
    return digest.hexdigest()
