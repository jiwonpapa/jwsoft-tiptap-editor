"""Bounded repository file access shared by every harness command."""

import hashlib
import json
from pathlib import Path
from typing import cast

type Json = bool | int | float | str | list[Json] | dict[str, Json] | None
type Object = dict[str, Json]

ROOT = Path(__file__).resolve().parents[2]


def repository_file(root: Path, relative: str) -> Path:
    candidate = root / relative
    resolved = candidate.resolve(strict=True)
    if Path(relative).is_absolute() or not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"Out-of-repository file: {relative}")
    if not resolved.is_file() or candidate.is_symlink():
        raise ValueError(f"Not a regular evidence file: {relative}")
    return resolved


def read_object(path: Path) -> Object:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path.name}")
    return cast(Object, value)


def object_value(value: Json) -> Object:
    if not isinstance(value, dict):
        raise ValueError("Expected JSON object")
    return value


def string_value(value: Json) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError("Expected nonempty string")
    return value


def hash_file(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_object(path: Path, data: Object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
