"""Own fresh authenticated G7 browser/HTTP executions and revoke the fixture identity."""

import os
import re
from datetime import UTC, datetime
from pathlib import Path

from .deploy_transaction import archive_manifest
from .execution import Execution
from .files import Object, hash_file, object_value, read_object, string_value, write_object
from .g7_browser_report import assemble_observations, validate_g7_reports
from .host import validate_host
from .integration import preflight
from .process import run


def verify_installed(root: Path, host: Path) -> str:
    version = string_value(read_object(root / "package.json")["version"])
    archive = root / ".build" / f"jwsoft-tiptap-editor-{version}.zip"
    found, files = archive_manifest(archive)
    if found != version:
        raise ValueError("The test package version differs")
    installed = host / "plugins/jwsoft-tiptap-editor"
    if any(
        not (installed / file).is_file() or hash_file(installed / file) != digest
        for file, digest in files.items()
    ):
        raise ValueError("Install the current ZIP before G7 browser verification")
    return hash_file(archive)


def fixtures(execution: Execution, output: Path) -> None:
    execution.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=128x224:rate=20",
            "-t",
            "3",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output / "fixture.mp4"),
        ]
    )
    execution.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:size=64x48",
            "-frames:v",
            "1",
            str(output / "fixture.png"),
        ]
    )


def run_http(execution: Execution, host: Path, base: str, output: Path) -> Object:
    account = read_object(output / "account.json")
    observed = object_value(read_object(output / "surfaces.json")["observations"])
    post = object_value(observed["public-board"])["postId"]
    environment = {**os.environ, "JWSOFT_DISPOSABLE_G7_TEST": "1"}
    empty_log = execution.run(
        [
            "php",
            "tests/integration/g7_empty_body_http_test.php",
            str(host),
            base,
            string_value(account["email"]),
            str(post),
        ],
        environment=environment,
    )
    empty = read_object(empty_log)
    if empty.get("passed") != 18 or empty.get("postContentUnchanged") is not True:
        raise ValueError("Actual empty-body HTTP proof did not pass")
    off_log = execution.run(
        [
            "php",
            "tests/integration/g7_image_off_http_test.php",
            str(host),
            base,
            str(output / "account.json"),
            str(output / "fixture.png"),
        ]
    )
    off = read_object(off_log)
    if off.get("blockedStatus") != 403 or off.get("rowsPreserved") is not True:
        raise ValueError("Actual image OFF HTTP proof did not pass")
    return {
        "emptyBody": {"rejectedRequests": empty["passed"], "contentHashesPreserved": True},
        "imageOff": off,
    }


def execute_g7(execution: Execution, host: Path, base: str, output: Path) -> Object:
    config = output / "config.json"
    write_object(config, {"base": base, "output": str(output), "runId": execution.run_id})
    fixtures(execution, output)
    execution.run(
        [
            "php",
            "tests/integration/g7_browser_account.php",
            str(host),
            "create",
            str(output / "account.json"),
            execution.run_id,
        ]
    )
    try:
        execution.run(["node", "tests/g7-browser/run.ts", str(config), "surfaces"])
        observed = object_value(read_object(output / "surfaces.json")["observations"])
        product = object_value(observed["ecommerce"])["productId"]
        execution.run(
            [
                "php",
                "tests/integration/g7_browser_legacy.php",
                str(host),
                str(output / "account.json"),
                str(product),
            ]
        )
        execution.run(["node", "tests/g7-browser/run.ts", str(config), "legacy"])
        return run_http(execution, host, base, output)
    finally:
        execution.run(
            [
                "php",
                "tests/integration/g7_browser_account.php",
                str(host),
                "revoke",
                str(output / "account.json"),
                execution.run_id,
            ]
        )


def run_g7_browser(root: Path, host: Path, base: str) -> None:
    host = host.resolve(strict=True)
    if not re.fullmatch(r"http://127\.0\.0\.1:\d+", base):
        raise ValueError("G7 browser testing only supports a disposable loopback server")
    version = preflight(root, host)
    checksum = verify_installed(root, host)
    execution = Execution(root, "test-results/harness/browser-g7.json", "g7-browser")
    output = root / "output/playwright" / execution.run_id
    output.mkdir(parents=True)
    try:
        http = execute_g7(execution, host, base, output)
        reports: Object = {
            phase: str((output / f"{phase}.json").relative_to(root))
            for phase in ("surfaces", "legacy")
        }
        counts = validate_g7_reports(root, {"reports": reports, "runId": execution.run_id})
        metadata: Object = {
            "schemaVersion": 2,
            "status": "pass",
            "g7Version": version,
            "pluginVersion": read_object(root / "package.json")["version"],
            "pluginPackageSha256": checksum,
            "sourceFingerprint": execution.fingerprint,
            "runtimeSha256": hash_file(root / "dist/js/plugin.iife.js"),
            "sourceCommit": run(["git", "rev-parse", "HEAD"], root, capture=True),
            "g7Commit": run(["git", "rev-parse", "HEAD"], host, capture=True),
            "observedAt": datetime.now(UTC).isoformat(),
            "executionRunId": execution.run_id,
            "browser": read_object(output / "surfaces.json")["browser"],
        }
        artifacts = assemble_observations(root, output, metadata, http)
        validate_host(root, host)
        execution.finish(
            [*artifacts, *[string_value(file) for file in reports.values()]],
            reports=reports,
            counts=counts,
            runtimeSha256=metadata["runtimeSha256"],
        )
    except BaseException:
        execution.fail()
        raise
