"""Execute tracked isolated browser suites without borrowing the user's browser."""

import os
from pathlib import Path

from .browser_report import validate_cases
from .execution import Execution
from .files import hash_file, read_object

UI_OBSERVATIONS = (
    "instance-lifecycle.json",
    "editor-ime.json",
    "editor-indentation.json",
    "editor-image-layout.json",
    "editor-document-appearance-chromium-desktop.json",
    "editor-document-appearance-chromium-mobile.json",
)


def run_browser(root: Path) -> None:
    execution = Execution(root, "test-results/harness/browser-ui.json", "isolated-editor-ui")
    report = execution.directory / "playwright.json"
    suites = sorted(root.glob("tests/e2e/editor-*.spec.ts"))
    suites.append(root / "tests/e2e/social-embeds.spec.ts")
    try:
        if len(suites) != 6 or not all(file.is_file() for file in suites):
            raise ValueError("The five editor suites and deterministic social suite are required")
        execution.run(["npm", "run", "build"])
        environment = dict(os.environ)
        environment.update(
            {
                "PLAYWRIGHT_JSON_OUTPUT_NAME": str(report),
                "JW_EXECUTION_RUN_ID": execution.run_id,
                "JW_EXECUTION_FINGERPRINT": execution.fingerprint,
            }
        )
        execution.run(
            [
                "node_modules/.bin/playwright",
                "test",
                "--reporter=list,json",
                *[str(file.relative_to(root)) for file in suites],
            ],
            environment=environment,
        )
        counts = validate_cases(
            read_object(report), read_object(root / "harness/contracts/browser-execution.json")
        )
        observations = [f"test-results/parity/browser/{file}" for file in UI_OBSERVATIONS]
        for file in observations:
            data = read_object(root / file)
            if data.get("executionRunId") != execution.run_id:
                raise ValueError(f"Observation did not come from this execution: {file}")
        execution.finish(
            [str(report.relative_to(root)), *observations],
            counts=counts,
            report=str(report.relative_to(root)),
            reportSha256=hash_file(report),
            runtimeSha256=hash_file(root / "dist/js/plugin.iife.js"),
        )
    except BaseException:
        execution.fail()
        raise
