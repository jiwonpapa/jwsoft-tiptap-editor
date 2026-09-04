"""The Python entrypoint owns checks; language-specific compilers remain native."""

import os
import sys
from pathlib import Path

from .dependencies import audit_python
from .execution import Execution
from .files import read_object
from .governance import check
from .license_source import validate_source_licenses
from .process import run, tracked_inputs
from .security import check_secrets

LEGACY_TESTS = (
    "license-audit",
    "deploy-evidence-test",
    "stable-evidence-test",
    "release-phases-test",
    "remote-deploy-preflight-test",
    "vendor-bundle-manifest-test",
)
PHP_TESTS = (
    "plugin_activation_test",
    "plugin_double_load_test",
    "editor_sanitizer_test",
    "parity_corpus_test",
    "upload_settings_test",
)


def validate_ci_tag(root: Path) -> None:
    ref = os.environ.get("GITHUB_REF", "")
    version = read_object(root / "package.json")["version"]
    if ref.startswith("refs/tags/") and ref != f"refs/tags/v{version}":
        raise ValueError("CI tag does not match the package version")


def check_all(root: Path) -> None:
    execution = Execution(root, "test-results/parity/checks.json", "checks")
    try:
        execute_checks(root, execution)
        execution.finish(["test-results/parity/unit.json", "test-results/parity/corpus.json"])
    except BaseException:
        execution.fail()
        raise


def execute_checks(root: Path, execution: Execution) -> None:
    validate_ci_tag(root)
    check(root)
    check_secrets(root)
    validate_source_licenses(root)
    execution.run([sys.executable, "-m", "ruff", "check", "harness"])
    execution.run([sys.executable, "-m", "ruff", "format", "--check", "harness"])
    execution.run([sys.executable, "-m", "mypy"])
    execution.run([sys.executable, "-m", "unittest", "discover", "-s", "harness/tests", "-v"])
    execution.run(["npm", "run", "check"])
    for name in LEGACY_TESTS:
        execution.run(["node", f"scripts/{name}.mjs"])
    execution.run(["composer", "validate", "--strict", "--no-check-publish"])
    execution.run(["vendor/bin/phpstan", "analyse", "--no-progress"])
    for name in PHP_TESTS:
        execution.run(["php", f"tests/php/{name}.php"])
    for relative in tracked_inputs(root):
        if relative.endswith(".php"):
            execution.run(["php", "-l", relative])
    execution.run(["bash", "scripts/check-shell.sh"])


def audit_dependencies(root: Path) -> None:
    # Audit is intentionally separate from offline checks; CI and release require both.
    run(["npm", "audit", "--json", "--audit-level=moderate"], root, capture=True)
    run(["composer", "audit", "--locked", "--no-interaction"], root)
    audit_python(root)
