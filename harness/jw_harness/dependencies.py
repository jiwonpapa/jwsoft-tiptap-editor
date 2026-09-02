"""Audit pinned Python tools against the fixed PyPI version metadata endpoint."""

import json
import re
import urllib.request
from collections.abc import Callable
from pathlib import Path

from .files import Object


def fetch_metadata(name: str, version: str) -> Object:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", name) or not re.fullmatch(r"[A-Za-z0-9_.-]+", version):
        raise ValueError("Invalid pinned Python dependency")
    url = f"https://pypi.org/pypi/{name}/{version}/json"
    with urllib.request.urlopen(url, timeout=20) as response:
        result = json.load(response)
    if not isinstance(result, dict) or not isinstance(result.get("vulnerabilities"), list):
        raise ValueError(f"Missing advisory response for {name}")
    return {"vulnerabilities": result["vulnerabilities"]}


def audit_python(root: Path, fetch: Callable[[str, str], Object] = fetch_metadata) -> int:
    count = 0
    for line in (root / "harness/requirements-dev.txt").read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        match = re.fullmatch(r"([A-Za-z0-9_.-]+)==([A-Za-z0-9_.-]+)", line)
        if not match:
            raise ValueError("Every Python dependency must be exactly pinned")
        name, version = match.groups()
        data = fetch(name, version)
        if data.get("vulnerabilities") != []:
            raise ValueError(f"Python advisory or incomplete response: {name}=={version}")
        count += 1
    if count == 0:
        raise ValueError("Python dependency inventory is empty")
    print(f"[jwsoft] Python advisory check passed: {count} pinned packages")
    return count
