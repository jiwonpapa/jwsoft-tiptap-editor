"""Human observations never become automated pass evidence."""

from pathlib import Path

from .files import Object, hash_file, read_object, repository_file, write_object


def record_observation(root: Path, relative: str) -> Path:
    source = repository_file(root, relative)
    data = read_object(source)
    output = root / "test-results/observations" / f"{hash_file(source)}.json"
    write_object(
        output,
        {
            "schemaVersion": 1,
            "status": "unverified",
            "kind": "human-observation",
            "source": relative,
            "sha256": hash_file(source),
            "observations": data,
        },
    )
    return output


def validate_browser_report(report: Object) -> Object:
    stats = report.get("stats")
    if not isinstance(stats, dict):
        raise ValueError("Playwright execution statistics are missing")
    expected = stats.get("expected")
    if type(expected) is not int or expected < 1:
        raise ValueError("No passing browser tests were executed")
    if stats.get("unexpected") != 0 or stats.get("flaky") != 0 or report.get("errors") != []:
        raise ValueError("Failed or flaky browser execution cannot produce pass evidence")
    skipped = stats.get("skipped")
    if type(skipped) is not int or skipped < 0:
        raise ValueError("Skipped count is missing")
    return {"passed": expected, "skipped": skipped, "failed": 0, "flaky": 0}
