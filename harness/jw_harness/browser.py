"""Execute tracked isolated browser suites without borrowing the user's browser."""

import os
import uuid
from pathlib import Path

from .evidence import validate_browser_report
from .files import Object, hash_file, read_object, write_object
from .process import run
from .provenance import source_fingerprint


def run_browser(root: Path) -> None:
    run_id = uuid.uuid4().hex
    directory = root / "test-results/harness" / run_id
    directory.mkdir(parents=True)
    report = directory / "playwright.json"
    receipt = root / "test-results/harness/browser-ui.json"
    fingerprint = source_fingerprint(root)
    started: Object = {
        "schemaVersion": 1,
        "status": "running",
        "scope": "isolated-editor-ui",
        "sourceFingerprint": fingerprint,
        "runId": run_id,
    }
    write_object(receipt, started)
    suites = sorted(root.glob("tests/e2e/editor-*.spec.ts"))
    suites.append(root / "tests/e2e/social-embeds.spec.ts")
    if len(suites) != 6 or not all(file.is_file() for file in suites):
        raise ValueError("The five editor suites and deterministic social suite are required")
    try:
        run(["npm", "run", "build"], root)
        environment = dict(os.environ)
        environment["PLAYWRIGHT_JSON_OUTPUT_NAME"] = str(report)
        run(
            [
                "node_modules/.bin/playwright",
                "test",
                "--reporter=list,json",
                *[str(file.relative_to(root)) for file in suites],
            ],
            root,
            environment=environment,
        )
        counts = validate_browser_report(read_object(report))
        if fingerprint != source_fingerprint(root):
            raise ValueError("Source changed while browser tests were running")
        write_object(
            receipt,
            {
                **started,
                "status": "pass",
                "counts": counts,
                "report": str(report.relative_to(root)),
                "reportSha256": hash_file(report),
                "runtimeSha256": hash_file(root / "dist/js/plugin.iife.js"),
            },
        )
    except Exception:
        write_object(receipt, {**started, "status": "failed"})
        raise
