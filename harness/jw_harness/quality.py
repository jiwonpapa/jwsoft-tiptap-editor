"""The Python entrypoint owns checks; language-specific compilers remain native."""

import os
import sys
from pathlib import Path

from .dependencies import audit_python
from .files import read_object
from .governance import check
from .process import run, tracked_inputs
from .provenance import source_fingerprint
from .security import check_secrets

LEGACY_TESTS = (
    "license-audit",
    "deploy-contract-test",
    "deploy-evidence-test",
    "stable-evidence-test",
    "release-phases-test",
    "remote-deploy-preflight-test",
    "remote-deploy-transaction-test",
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
    fingerprint = source_fingerprint(root)
    validate_ci_tag(root)
    check(root)
    check_secrets(root)
    run([sys.executable, "-m", "ruff", "check", "harness"], root)
    run([sys.executable, "-m", "ruff", "format", "--check", "harness"], root)
    run([sys.executable, "-m", "mypy"], root)
    run([sys.executable, "-m", "unittest", "discover", "-s", "harness/tests", "-v"], root)
    run(["npm", "run", "check"], root)
    for name in LEGACY_TESTS:
        run(["node", f"scripts/{name}.mjs"], root)
    run(["composer", "validate", "--strict", "--no-check-publish"], root)
    run(["vendor/bin/phpstan", "analyse", "--no-progress"], root)
    for name in PHP_TESTS:
        run(["php", f"tests/php/{name}.php"], root)
    for relative in tracked_inputs(root):
        if relative.endswith(".php"):
            run(["php", "-l", relative], root)
    run(["bash", "scripts/check-shell.sh"], root)
    if fingerprint != source_fingerprint(root):
        raise ValueError("Source changed during checks; rerun before recording pass evidence")
    run(["node", "scripts/evidence-provenance.mjs", "record-checks"], root)


def audit_dependencies(root: Path) -> None:
    # Audit is intentionally separate from offline checks; CI and release require both.
    run(["npm", "audit", "--audit-level=moderate"], root)
    run(["composer", "audit", "--locked", "--no-interaction"], root)
    audit_python(root)
