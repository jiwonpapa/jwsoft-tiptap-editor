"""Clean only disposable caches; never delete packages, evidence or a G7 host."""

import shutil
from pathlib import Path

CACHE_PATHS = (".ruff_cache", ".mypy_cache", ".pytest_cache", "node_modules/.vite")


def clean_caches(root: Path, *, apply: bool = False) -> list[str]:
    targets: list[Path] = []
    for relative in CACHE_PATHS:
        target = root / relative
        if target.is_symlink() or not target.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Refusing unsafe cleanup target: {relative}")
        if target.exists():
            if not target.is_dir():
                raise ValueError(f"Cache is not a directory: {relative}")
            targets.append(target)
    if apply:
        for target in targets:
            shutil.rmtree(target)
    return [str(target.relative_to(root)) for target in targets]
