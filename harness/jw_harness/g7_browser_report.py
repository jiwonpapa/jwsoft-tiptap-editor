"""Validate actual G7 browser assertions and assemble release observations."""

from datetime import UTC, datetime
from pathlib import Path

from .browser_report import items
from .files import (
    Json,
    Object,
    hash_file,
    object_value,
    read_object,
    repository_file,
    string_value,
    write_object,
)


def validate_g7_reports(root: Path, data: Object) -> Object:
    phases = object_value(
        read_object(root / "harness/contracts/g7-browser-execution.json")["phases"]
    )
    reports = object_value(data.get("reports"))
    if set(reports) != set(phases):
        raise ValueError("Required G7 browser phase is missing")
    total = 0
    for phase, required in phases.items():
        report = read_object(repository_file(root, string_value(reports[phase])))
        if report.get("status") != "pass" or report.get("runId") != data.get("runId"):
            raise ValueError("G7 browser report did not pass in this run")
        cases = [object_value(case) for case in items(report.get("cases"))]
        if [case.get("id") for case in cases] != required:
            raise ValueError("Required G7 browser assertions were skipped or duplicated")
        for case in cases:
            if case.get("status") != "passed":
                raise ValueError("G7 browser assertion failed")
            start = datetime.fromisoformat(string_value(case.get("startedAt")))
            end = datetime.fromisoformat(string_value(case.get("finishedAt")))
            if start.tzinfo is None or end.tzinfo is None or not start <= end <= datetime.now(UTC):
                raise ValueError("G7 assertion timestamps are invalid")
        total += len(cases)
    return {"passed": total, "skipped": 0, "failed": 0, "flaky": 0}


def validate_g7_execution(root: Path, data: Object) -> None:
    counts = validate_g7_reports(root, data)
    commands = [items(object_value(item).get("argv")) for item in items(data.get("commands"))]
    phases = [args[-1] for args in commands if args[:2] == ["node", "tests/g7-browser/run.ts"]]
    if phases != ["surfaces", "legacy"]:
        raise ValueError("Actual G7 browser driver phases were not executed")
    for required in ("g7_empty_body_http_test.php", "g7_image_off_http_test.php"):
        if not any(args[:2] == ["php", f"tests/integration/{required}"] for args in commands):
            raise ValueError("Actual G7 HTTP regression was not executed")
    if counts != data.get("counts"):
        raise ValueError("G7 browser execution counters differ")


def screenshot_evidence(root: Path, value: Json) -> list[Json]:
    result: list[Json] = []
    for path in items(value):
        file = Path(string_value(path)).resolve(strict=True)
        if not file.is_relative_to(root / "output/playwright") or file.suffix != ".png":
            raise ValueError("Screenshot is not a run-owned browser PNG")
        result.append({"file": str(file.relative_to(root)), "sha256": hash_file(file)})
    if not result:
        raise ValueError("Actual G7 screenshots are required")
    return result


def assemble_observations(root: Path, output: Path, metadata: Object, http: Object) -> list[str]:
    surfaces = read_object(output / "surfaces.json")
    observations = object_value(surfaces["observations"])
    mobile = object_value(observations["mobile-dark-i18n"])
    legacy = object_value(read_object(output / "legacy.json")["observations"])
    docs: dict[str, Object] = {
        "public-board.json": object_value(observations["public-board"]),
        "admin-board.json": object_value(observations["admin-board"]),
        "page-surface.json": object_value(observations["page"]),
        "ecommerce-surface.json": object_value(observations["ecommerce"]),
        "direct-html-editor-fallback.json": object_value(observations["fallback"]),
        "evidence.json": {
            **mobile,
            "surfaces": {
                "board": observations["public-board"],
                "page": observations["page"],
                "ecommerce": observations["ecommerce"],
            },
            "performance": {
                "readyMs": surfaces["timings"],
                "instances": [1] * len(items(surfaces["timings"])),
            },
        },
        "functional-audit.json": {
            "screenshots": object_value(observations["mp4"])["screenshots"],
            "observations": {
                "emptyBody": http["emptyBody"],
                "imageOff": http["imageOff"],
                "images": {
                    "public": observations["public-board"],
                    "admin": observations["admin-board"],
                    **object_value(observations["invalid-images"]),
                },
                "mp4": observations["mp4"],
                "urls": observations["urls"],
                "multilingual": observations["ecommerce"],
                "legacyConsent": legacy["legacy-consent"],
            },
        },
    }
    artifacts = []
    for name, observed in docs.items():
        relative = f"test-results/parity/browser/{name}"
        shots = screenshot_evidence(root, observed["screenshots"])
        write_object(root / relative, {**observed, **metadata, "screenshots": shots})
        artifacts.append(relative)
        artifacts.extend(string_value(object_value(shot)["file"]) for shot in shots)
    return sorted(set(artifacts))
