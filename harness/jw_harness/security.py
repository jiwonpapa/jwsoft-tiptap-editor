"""A targeted secret-material gate, not a claim of exhaustive secret detection."""

import re
from pathlib import Path

from .process import tracked_inputs

TEXT_SUFFIXES = {
    ".ts",
    ".js",
    ".mjs",
    ".py",
    ".php",
    ".sh",
    ".json",
    ".yml",
    ".yaml",
    ".md",
    ".toml",
    ".txt",
    ".env",
}
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{50,}\b"),
    re.compile(r"\bAKIA[A-Z0-9]{16}\b"),
)


def contains_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in SECRET_PATTERNS)


def check_secrets(root: Path) -> None:
    failures: list[str] = []
    for relative in tracked_inputs(root):
        path = root / relative
        if path.is_file() and path.suffix in TEXT_SUFFIXES:
            if contains_secret(path.read_text(encoding="utf-8")):
                failures.append(relative)
    if failures:
        # Never echo matching credentials into logs.
        raise ValueError("Secret material found in: " + ", ".join(failures))
