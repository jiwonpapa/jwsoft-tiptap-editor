"""Release consumers verify executed commands, results, and requirement coverage."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from .audit import AUDIT_RECEIPT, validate_audit
from .browser import UI_OBSERVATIONS
from .browser_report import items, validate_cases
from .files import Object, hash_file, object_value, read_object, repository_file, string_value
from .g7_browser_report import validate_g7_execution
from .integration import INTEGRATION_TESTS
from .process import run


def validate_journal(root: Path, relative: str, fingerprint: str, scope: str) -> Object:
    data = read_object(repository_file(root, relative))
    if data.get("schemaVersion") != 2 or data.get("status") != "pass" or data.get("scope") != scope:
        raise ValueError("A successful runner execution receipt is required")
    if data.get("sourceFingerprint") != fingerprint:
        raise ValueError("Execution receipt has stale source inputs")
    validate_time(data)
    commands = items(data.get("commands"))
    if not commands:
        raise ValueError("No executed commands in receipt")
    for item in commands:
        command = object_value(item)
        if command.get("exitCode") != 0 or not items(command.get("argv")):
            raise ValueError("Execution contains a failed or absent command")
        log = repository_file(root, string_value(command.get("log")))
        if hash_file(log) != command.get("logSha256"):
            raise ValueError("Execution log digest mismatch")
    for artifact, digest in object_value(data.get("artifacts")).items():
        if hash_file(repository_file(root, artifact)) != digest:
            raise ValueError("Execution artifact digest mismatch")
    return data


def validate_time(data: Object) -> None:
    started = datetime.fromisoformat(string_value(data.get("startedAt")))
    finished = datetime.fromisoformat(string_value(data.get("finishedAt")))
    now = datetime.now(UTC)
    if started.tzinfo is None or finished.tzinfo is None or not started <= finished <= now:
        raise ValueError("Execution timestamps are invalid")
    if now - started > timedelta(days=1):
        raise ValueError("Execution is older than the 24 hour release window")


def validate_integration(root: Path, data: Object) -> None:
    commands = [items(object_value(item).get("argv")) for item in items(data.get("commands"))]
    expected = list(INTEGRATION_TESTS)
    executed = [args[1] for args in commands if len(args) >= 3]
    if executed != expected:
        raise ValueError("Required integration commands were not all executed")
    for item in items(data.get("checks")):
        check = object_value(item)
        file = repository_file(root, string_value(check.get("file")))
        if check.get("status") != "pass" or check.get("sha256") != hash_file(file):
            raise ValueError("Integration test digest mismatch")


def validate_browser(root: Path, data: Object, artifact: str) -> None:
    observed = read_object(repository_file(root, artifact))
    if observed.get("executionRunId") != data.get("runId"):
        raise ValueError("Browser observation is not from this runner execution")
    if observed.get("sourceFingerprint") != data.get("sourceFingerprint"):
        raise ValueError("Browser observation has stale source inputs")
    if observed.get("sourceCommit") != run(["git", "rev-parse", "HEAD"], root, capture=True):
        raise ValueError("Browser observation source commit is stale")
    if data.get("scope") == "g7-browser":
        validate_g7_execution(root, data)
        return
    report_file = repository_file(root, string_value(data.get("report")))
    if hash_file(report_file) != data.get("reportSha256"):
        raise ValueError("Browser execution report digest mismatch")
    counts = validate_cases(
        read_object(report_file), read_object(root / "harness/contracts/browser-execution.json")
    )
    if counts != data.get("counts"):
        raise ValueError("Browser execution counters differ")


def execution_route(artifact: str) -> tuple[str, str]:
    if artifact == AUDIT_RECEIPT:
        return artifact, "dependency-audit"
    if artifact in ("test-results/parity/unit.json", "test-results/parity/corpus.json"):
        receipt, scope = "test-results/parity/checks.json", "checks"
    elif artifact == "test-results/parity/integration.json":
        receipt, scope = artifact, "g7-integration"
    elif artifact.startswith("test-results/parity/browser/"):
        ui = Path(artifact).name in UI_OBSERVATIONS
        receipt = f"test-results/harness/browser-{'ui' if ui else 'g7'}.json"
        scope = "isolated-editor-ui" if ui else "g7-browser"
    elif artifact in (
        "test-results/parity/lifecycle/evidence.json",
        "test-results/parity/github-lifecycle/evidence.json",
    ):
        scope = Path(artifact).parent.name
        receipt = f"test-results/harness/{scope}.json"
    else:
        raise ValueError("Unsupported execution artifact")
    return receipt, scope


def validate_lifecycle_execution(root: Path, data: Object, artifact: str) -> None:
    observed = read_object(root / artifact)
    if observed.get("executionRunId") != data.get("runId"):
        raise ValueError("Lifecycle artifact is not from this execution")
    commands = [items(object_value(item).get("argv")) for item in items(data.get("commands"))]
    for script in ("g7_content_probe.php", "g7_lifecycle_probe.php"):
        if not any(args[:2] == ["php", f"tests/integration/{script}"] for args in commands):
            raise ValueError("Lifecycle probes were not executed")
    updates = [args for args in commands if args[:3] == ["php", "artisan", "plugin:update"]]
    if len(updates) != 2:
        raise ValueError("Both lifecycle updates must execute")
    if data.get("scope") == "github-lifecycle":
        required = [
            ["php", "tests/integration/g7_remote_plugin_action.php"],
            ["php", "artisan", "plugin:uninstall"],
        ]
        if any(sum(args[: len(prefix)] == prefix for args in commands) != 2 for prefix in required):
            raise ValueError("Both real install/uninstall cycles must execute")
        if "--source=github" not in updates[-1]:
            raise ValueError("A real GitHub update must execute")
    elif not any(
        args[:2] == ["php", "tests/integration/g7_editor_conflict_test.php"] for args in commands
    ):
        raise ValueError("Concurrent activation refusal must execute")


def validate_artifact_execution(root: Path, artifact: str, fingerprint: str) -> None:
    if artifact in ("test-results/deploy/staging.json", "test-results/deploy/production.json"):
        from .deploy_evidence import validate_deployment

        validate_deployment(root, artifact, fingerprint)
        return
    receipt, scope = execution_route(artifact)
    data = validate_journal(root, receipt, fingerprint, scope)
    if scope == "dependency-audit":
        validate_audit(root, data)
        return
    if scope == "g7-integration":
        validate_integration(root, data)
        return
    if object_value(data.get("artifacts")).get(artifact) != hash_file(
        repository_file(root, artifact)
    ):
        raise ValueError("Artifact was not produced by the runner execution")
    if scope == "checks":
        commands = [items(object_value(item).get("argv")) for item in items(data.get("commands"))]
        if ["npm", "run", "check"] not in commands or [
            "php",
            "tests/php/parity_corpus_test.php",
        ] not in commands:
            raise ValueError("Required check commands were not executed")
    elif scope in ("isolated-editor-ui", "g7-browser"):
        validate_browser(root, data, artifact)
    else:
        validate_lifecycle_execution(root, data, artifact)
