"""Require an explicit dedicated-host marker before Laravel integration can run."""

from pathlib import Path

from .files import read_object
from .process import run


def validate_host(project: Path, host: Path) -> None:
    host = host.resolve(strict=True)
    if host == project.resolve() or host == Path.home() or host == Path(host.anchor):
        raise ValueError("G7 must be a dedicated test checkout, not a workspace/home root")
    marker = read_object(host / ".jw-editor-harness.json")
    if marker != {"schemaVersion": 1, "owner": "jwsoft-tiptap-editor", "purpose": "dedicated-test"}:
        raise ValueError("G7 dedicated-host marker is missing or invalid")
    for relative in ("artisan", "config/app.php"):
        if not (host / relative).is_file():
            raise ValueError(f"G7 contract missing: {relative}")
    top = run(["git", "rev-parse", "--show-toplevel"], host, capture=True)
    if Path(top).resolve() != host:
        raise ValueError("G7_ROOT must be the exact dedicated checkout root")
    if run(["git", "status", "--porcelain"], host, capture=True):
        raise ValueError("G7 checkout must be clean; dirty overrides are not accepted")
