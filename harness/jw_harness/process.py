"""Run argument arrays, never shell strings. Errors are not success observations."""

import subprocess
from collections.abc import Mapping, Sequence
from pathlib import Path


def run(
    argv: Sequence[str],
    root: Path,
    *,
    capture: bool = False,
    environment: Mapping[str, str] | None = None,
) -> str:
    result = subprocess.run(  # noqa: S603 -- fixed command plans, no shell expansion
        list(argv),
        cwd=root,
        check=True,
        text=True,
        capture_output=capture,
        timeout=1200,
        env=environment,
    )
    return result.stdout.strip() if capture else ""


def tracked_inputs(root: Path) -> list[str]:
    return run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        root,
        capture=True,
    ).split("\0")[:-1]
