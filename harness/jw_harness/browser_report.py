"""Validate named cases, allowed skips, projects, and real Playwright results."""

from .evidence import validate_browser_report
from .files import Json, Object, object_value, string_value


def items(value: Json) -> list[Json]:
    if not isinstance(value, list):
        raise ValueError("Expected execution list")
    return value


def case_key(case: Object) -> str:
    return "::".join(string_value(case.get(key)) for key in ("file", "title", "project"))


def test_cases(suites: list[Json]) -> dict[str, Object]:
    found: dict[str, Object] = {}
    for entry in suites:
        suite = object_value(entry)
        for value in items(suite.get("specs", [])):
            spec = object_value(value)
            for test in items(spec.get("tests")):
                result = object_value(test)
                key = case_key(
                    {
                        "file": spec.get("file"),
                        "title": spec.get("title"),
                        "project": result.get("projectName"),
                    }
                )
                if key in found:
                    raise ValueError("Duplicate browser execution case")
                found[key] = result
        for key, result in test_cases(items(suite.get("suites", []))).items():
            if key in found:
                raise ValueError("Duplicate nested browser execution case")
            found[key] = result
    return found


def validate_cases(report: Object, contract: Object) -> Object:
    counts = validate_browser_report(report)
    declared = [object_value(value) for value in items(contract.get("cases"))]
    expected = {case_key(value): value.get("required") for value in declared}
    found = test_cases(items(report.get("suites")))
    if len(expected) != len(declared) or not expected or set(found) != set(expected):
        raise ValueError("Required named browser cases or projects are missing/duplicated")
    passed = skipped = 0
    for key, result in found.items():
        required = expected[key]
        attempts = items(result.get("results"))
        if type(required) is not bool or len(attempts) != 1:
            raise ValueError(f"Invalid requirement or retry for {key}")
        status = object_value(attempts[0]).get("status")
        if status == "passed" and result.get("status") == "expected":
            passed += 1
        elif status == "skipped" and not required and result.get("status") == "skipped":
            skipped += 1
        else:
            raise ValueError(f"Required browser case failed or was skipped: {key}")
    if counts["passed"] != passed or counts["skipped"] != skipped:
        raise ValueError("Playwright statistics disagree with executed named cases")
    return counts
