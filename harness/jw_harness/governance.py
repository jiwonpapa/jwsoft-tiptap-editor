"""Enforce bounded source files, migration inventory and explicit expiring debt."""

import ast
import re
from collections.abc import Callable
from datetime import date
from pathlib import Path

from .files import Object, object_value, read_object, string_value
from .process import tracked_inputs

GENERATED = {
    "resources/js/generated/editorPolicy.ts",
    "src/Generated/EditorPolicy.php",
    "dist/js/plugin.iife.js",
}
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".php", ".sh"}


def file_limit(relative: str) -> int:
    if relative.endswith(".py") and not relative.startswith("harness/tests/"):
        return 300
    if "/tests/" in relative or relative.startswith("tests/") or ".test." in relative:
        return 650
    return 450


def debt_errors(
    debt: Object,
    today: date,
    minimum: Callable[[str], int] = file_limit,
) -> list[str]:
    errors: list[str] = []
    for relative, raw in debt.items():
        item = object_value(raw)
        for field in ("owner", "reason", "expires"):
            string_value(item.get(field))
        if date.fromisoformat(string_value(item["expires"])) <= today:
            errors.append(f"Expired debt: {relative}")
        maximum = item.get("maxLines")
        if type(maximum) is not int or maximum <= minimum(relative):
            errors.append(f"Invalid size exception: {relative}")
    return errors


def python_errors(relative: str, text: str) -> list[str]:
    errors: list[str] = []
    for node in ast.walk(ast.parse(text, filename=relative)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if (node.end_lineno or node.lineno) - node.lineno + 1 > 80:
                errors.append(f"Function exceeds 80 lines: {relative}:{node.lineno}")
        if isinstance(node, ast.Call):
            for keyword in node.keywords:
                if keyword.arg == "shell" and not (
                    isinstance(keyword.value, ast.Constant) and keyword.value.value is False
                ):
                    errors.append(f"shell execution is forbidden: {relative}:{node.lineno}")
    return errors


def inspect_source(relative: str, text: str, policy: Object) -> list[str]:
    errors: list[str] = []
    debt = object_value(policy["files"])
    maximum = object_value(debt[relative])["maxLines"] if relative in debt else file_limit(relative)
    if isinstance(maximum, int) and len(text.splitlines()) > maximum:
        errors.append(f"File exceeds {maximum} lines: {relative}")
    if relative.startswith(("scripts/", "harness/")) and relative.endswith(
        (".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx")
    ):
        allowed = {
            **object_value(policy["legacyNode"]),
            **object_value(policy.get("nativeNode", {})),
        }
        if relative not in allowed:
            errors.append(f"New generic JS harness forbidden; use Python: {relative}")
    if re.search(
        r"(?m)^\s*(?://|#|/\*|\*)[^\n]*(?:@ts-(?:ignore|nocheck)|@phpstan-ignore|eslint-disable)",
        text,
    ):
        errors.append(f"Unreviewed checker suppression: {relative}")
    if relative.endswith(".py"):
        errors.extend(python_errors(relative, text))
    return errors


def check(root: Path) -> None:
    policy = read_object(root / "harness/governance/debt.json")
    errors = debt_errors(object_value(policy["files"]), date.today())
    errors.extend(debt_errors(object_value(policy["functions"]), date.today(), lambda _: 80))
    migration = object_value(policy["migration"])
    if date.fromisoformat(string_value(migration["expires"])) <= date.today():
        errors.append("Legacy Node harness migration has expired")
    inputs = tracked_inputs(root)
    for relative in inputs:
        if relative in GENERATED:
            continue
        path = root / relative
        if path.suffix in EXTENSIONS and path.is_file():
            errors.extend(inspect_source(relative, path.read_text(encoding="utf-8"), policy))
    if errors:
        raise ValueError("\n".join(errors))
    print("[jwsoft] source governance passed; recorded legacy debt is NOT completed refactoring")
