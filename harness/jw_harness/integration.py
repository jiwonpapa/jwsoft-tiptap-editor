"""Execute all G7 contracts against an explicitly registered, clean checkout."""

import re
from pathlib import Path

from .execution import Execution
from .files import Json, hash_file
from .host import validate_host
from .process import run

INTEGRATION_TESTS = (
    "tests/integration/g7_middleware_test.php",
    "tests/integration/g7_settings_test.php",
    "tests/integration/g7_admin_security_test.php",
    "tests/integration/g7_image_subsystem_test.php",
    "tests/integration/g7_media_subsystem_test.php",
    "tests/integration/g7_link_preview_test.php",
    "tests/integration/g7_state_sync_test.mjs",
)


def preflight(root: Path, host: Path) -> str:
    validate_host(root, host)
    version = re.search(
        r"'version'.*?env\('[^']+',\s*'([^']+)'", (host / "config/app.php").read_text()
    )
    if version is None:
        raise ValueError("G7 version cannot be read")
    value = version.group(1)
    run(["php", "-r", 'exit(version_compare($argv[1], "7.0.9", ">=") ? 0 : 1);', value], root)
    commands = run(["php", "artisan", "list", "--raw"], host, capture=True)
    for command in (
        "plugin:install",
        "plugin:update",
        "plugin:activate",
        "plugin:deactivate",
        "plugin:list",
    ):
        if not re.search(rf"^{re.escape(command)}\s", commands, re.MULTILINE):
            raise ValueError(f"G7 command missing: {command}")
    for command, flag in (("plugin:install", "--vendor-mode"), ("plugin:update", "--zip")):
        if flag not in run(["php", "artisan", command, "--help"], host, capture=True):
            raise ValueError(f"G7 command contract missing: {command} {flag}")
    return value


def run_integration(root: Path, host: Path) -> None:
    host = host.resolve(strict=True)
    execution = Execution(root, "test-results/parity/integration.json", "g7-integration")
    try:
        version = preflight(root, host)
        checks: list[Json] = []
        for file in INTEGRATION_TESTS:
            argv = ["node" if file.endswith(".mjs") else "php", file, str(host)]
            if file.endswith(".php"):
                argv.append(str(root))
            execution.run(argv)
            checks.append({"file": file, "status": "pass", "sha256": hash_file(root / file)})
        validate_host(root, host)
        execution.finish([], g7Version=version, checks=checks)
    except BaseException:
        execution.fail()
        raise
