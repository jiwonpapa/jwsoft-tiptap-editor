"""Publish the exact version's committed change list, not a generic summary."""

import re
from pathlib import Path


def changelog_entry(root: Path, tag: str) -> str:
    version = tag.removeprefix("v")
    text = (root / "CHANGELOG.md").read_text(encoding="utf-8")
    sections = list(re.finditer(r"^## (.+)$", text, re.MULTILINE))
    matching = [
        index for index, match in enumerate(sections) if match[1].startswith(f"[{version}]")
    ]
    if len(matching) != 1:
        raise ValueError("Release requires exactly one dated CHANGELOG entry for its version")
    index = matching[0]
    if not re.fullmatch(rf"\[{re.escape(version)}\] - \d{{4}}-\d{{2}}-\d{{2}}", sections[index][1]):
        raise ValueError("Release CHANGELOG heading must use the dated canonical format")
    end = sections[index + 1].start() if index + 1 < len(sections) else len(text)
    body = text[sections[index].end() : end].strip()
    if not re.search(r"^- \S", body, re.MULTILINE):
        raise ValueError("Release CHANGELOG entry must contain meaningful change bullets")
    return body
