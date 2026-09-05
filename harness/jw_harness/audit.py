"""Dependency advisory evidence belongs to the actual three-language audit execution."""

import sys
from pathlib import Path

from .execution import Execution
from .files import Object, hash_file, object_value, read_object

AUDIT_RECEIPT = "test-results/harness/audit.json"
AUDIT_INPUTS = ("package-lock.json", "composer.lock", "harness/requirements-dev.txt")
NPM_AUDIT = [
    "npm",
    "audit",
    "--json",
    "--audit-level=moderate",
    "--fetch-timeout=60000",
    "--fetch-retries=2",
]
COMPOSER_AUDIT = ["composer", "audit", "--locked", "--no-interaction", "--format=json"]
PYTHON_AUDIT = ["-m", "harness.jw_harness", "audit-python"]


def audit_inputs(root: Path) -> Object:
    return {relative: hash_file(root / relative) for relative in AUDIT_INPUTS}


def audit_dependencies(root: Path) -> None:
    execution = Execution(root, AUDIT_RECEIPT, "dependency-audit")
    try:
        inputs = audit_inputs(root)
        for command in (
            ["npm", "--version"],
            ["composer", "--version"],
            [sys.executable, "--version"],
        ):
            execution.run(command)
        npm = read_object(execution.run(NPM_AUDIT))
        counts = object_value(object_value(npm.get("metadata")).get("vulnerabilities"))
        if "error" in npm or any(
            counts.get(level) != 0 for level in ("moderate", "high", "critical")
        ):
            raise ValueError("npm advisory report is incomplete or has blocking vulnerabilities")
        composer = read_object(execution.run(COMPOSER_AUDIT))
        if composer.get("advisories") not in ({}, []):
            raise ValueError("Composer advisory report is incomplete or vulnerable")
        execution.run([sys.executable, *PYTHON_AUDIT])
        if inputs != audit_inputs(root):
            raise ValueError("Dependency inputs changed during audit")
        execution.finish([], inputs=inputs)
    except BaseException:
        execution.fail()
        raise


def validate_audit(root: Path, data: Object) -> None:
    if data.get("inputs") != audit_inputs(root):
        raise ValueError("Audit lockfile inputs are missing or stale")
    commands = data.get("commands")
    if not isinstance(commands, list):
        raise ValueError("Missing audit commands")
    args = [object_value(item).get("argv") for item in commands]
    if (
        NPM_AUDIT not in args
        or COMPOSER_AUDIT not in args
        or not any(isinstance(argv, list) and argv[1:] == PYTHON_AUDIT for argv in args)
    ):
        raise ValueError("All three dependency audits must actually execute")
