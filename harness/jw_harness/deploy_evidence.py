"""Deployment receipts are produced by the owning transaction, never by user-entered pass."""

import hashlib
from datetime import UTC, datetime
from pathlib import Path

from .deploy_transaction import archive_manifest, verify_archive
from .execution import Execution
from .files import (
    Object,
    hash_file,
    object_value,
    read_object,
    repository_file,
    string_value,
    write_object,
)


def digest_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def validate_deployment(root: Path, artifact: str, fingerprint: str) -> Object:
    from .receipt import validate_journal

    environment = Path(artifact).stem
    if environment not in ("staging", "production"):
        raise ValueError("Unknown deployment environment")
    data = read_object(repository_file(root, artifact))
    journal = validate_journal(
        root,
        f"test-results/harness/deploy-{environment}.json",
        fingerprint,
        f"deploy-{environment}",
    )
    if (
        data.get("schemaVersion") != 3
        or data.get("status") != "pass"
        or data.get("environment") != environment
    ):
        raise ValueError("A transaction-owned deployment result is required")
    if data.get("executionRunId") != journal.get("runId") or object_value(
        journal.get("artifacts")
    ).get(artifact) != hash_file(root / artifact):
        raise ValueError("Deployment result is not bound to this execution")
    validate_deployment_commands(root, journal)
    validate_deployment_snapshots(root, journal, data)
    if environment == "production":
        validate_promotion(root, data, fingerprint)
    return data


def validate_deployment_commands(root: Path, journal: Object) -> None:
    commands = journal.get("commands")
    if not isinstance(commands, list):
        raise ValueError("Missing deployment commands")
    labels = [object_value(item).get("label") for item in commands]
    for label in (
        "remote-deploy-preflight.sh",
        "stage",
        "remote-deploy-apply.sh",
        "remote-editor-command.sh",
        "remote-editor-state.php",
        "smoke",
    ):
        if label not in labels:
            raise ValueError(f"Missing executed deployment step: {label}")
    if (
        not labels.index("remote-deploy-preflight.sh")
        < labels.index("remote-deploy-apply.sh")
        < labels.index("smoke")
    ):
        raise ValueError("Invalid deployment execution ordering")
    for item in commands:
        command = object_value(item)
        script_label = command.get("label")
        transport = (
            "ssh"
            if str(script_label).startswith("remote-")
            else {"stage": "rsync", "smoke": "curl"}.get(str(script_label))
        )
        argv = command.get("argv")
        if transport and (
            not isinstance(argv, list) or not argv or Path(string_value(argv[0])).name != transport
        ):
            raise ValueError("Deployment step did not execute its required transport")
        if script_label in ("remote-deploy-preflight.sh", "remote-deploy-apply.sh") and command.get(
            "inputSha256"
        ) != hash_file(root / "scripts" / string_value(script_label)):
            raise ValueError("Executed deployment script differs from current source")


def validate_promotion(root: Path, data: Object, fingerprint: str) -> None:
    staging = validate_deployment(root, "test-results/deploy/staging.json", fingerprint)
    if (
        data.get("stagingEvidenceSha256") != hash_file(root / "test-results/deploy/staging.json")
        or data.get("pluginVersion") != staging.get("pluginVersion")
        or data.get("artifact") != staging.get("artifact")
        or data.get("sameAsStaging") is not True
    ):
        raise ValueError("Production is not bound to the executed staging deployment")
    if datetime.fromisoformat(string_value(data.get("appliedAt"))) <= datetime.fromisoformat(
        string_value(staging.get("appliedAt"))
    ):
        raise ValueError("Production must execute after staging")
    if data.get("targetFingerprint") == staging.get("targetFingerprint") and (
        data.get("sameTargetAsStaging") is not True
        or data.get("sameTargetPromotionApproved") is not True
    ):
        raise ValueError("Same-target promotion approval is missing")


def validate_deployment_snapshots(root: Path, journal: Object, data: Object) -> None:
    for key in ("before", "after"):
        relative = string_value(data.get(key))
        if object_value(journal.get("artifacts")).get(relative) != hash_file(
            repository_file(root, relative)
        ):
            raise ValueError("Deployment snapshot is not owned by the execution")
    package = object_value(data.get("artifact"))
    archive = repository_file(root, f".build/{string_value(package.get('name'))}")
    if hash_file(archive) != package.get("sha256"):
        raise ValueError("Deployment archive digest differs")
    version, files = archive_manifest(archive)
    after = read_object(repository_file(root, string_value(data.get("after"))))
    verify_archive(after, version, files)
    if (
        data.get("pluginVersion") != version
        or after.get("jwActive") is not True
        or after.get("ckActive") is not False
    ):
        raise ValueError("Verified deployment version/editor state differs")


def verify_staging(
    root: Path, version: str, checksum: str, target: str, same_target: bool
) -> Object:
    from .provenance import source_fingerprint

    staging = validate_deployment(
        root, "test-results/deploy/staging.json", source_fingerprint(root)
    )
    if (
        staging.get("pluginVersion") != version
        or object_value(staging.get("artifact")).get("sha256") != checksum
    ):
        raise ValueError("Staging version or checksum differs")
    if not target or (staging.get("targetFingerprint") == digest_text(target) and not same_target):
        raise ValueError("Same-target promotion requires explicit approval")
    return staging


def preserve_previous(root: Path, environment: str) -> None:
    current = root / f"test-results/deploy/{environment}.json"
    if current.is_file():
        archive = current.parent / "history" / f"{environment}-{hash_file(current)}.json"
        if not archive.exists():
            write_object(archive, read_object(current))


def finish_deployment(
    execution: Execution,
    environment: str,
    archive: Path,
    values: dict[str, str],
    snapshots: Object,
    staging: Object | None,
) -> None:
    root = execution.root
    artifacts = []
    paths: Object = {}
    for key in ("before", "after"):
        file = execution.directory / f"{key}.json"
        write_object(file, object_value(snapshots.get(key)))
        paths[key] = str(file.relative_to(root))
        artifacts.append(str(file.relative_to(root)))
    version, _ = archive_manifest(archive)
    target = digest_text(f"{values['DEPLOY_HOST']}:{values['G7_REMOTE_ROOT']}")
    same = staging is not None and staging.get("targetFingerprint") == target
    data: Object = {
        "schemaVersion": 3,
        "status": "pass",
        "environment": environment,
        "pluginVersion": version,
        "executionRunId": execution.run_id,
        "artifact": {"name": archive.name, "sha256": hash_file(archive)},
        "deployMode": values["DEPLOY_MODE"],
        "appEnvironment": values["EXPECTED_APP_ENV"],
        "targetFingerprint": target,
        "smokeUrlFingerprint": digest_text(values["SMOKE_URL"]),
        "sameAsStaging": staging is not None,
        "sameTargetAsStaging": same,
        "sameTargetPromotionApproved": same and values.get("SAME_TARGET_PROMOTION_APPROVED") == "1",
        "stagingEvidenceSha256": hash_file(root / "test-results/deploy/staging.json")
        if staging
        else None,
        "stagingAppliedAt": staging.get("appliedAt") if staging else None,
        "appliedAt": datetime.now(UTC).isoformat(),
        **paths,
    }
    relative = f"test-results/deploy/{environment}.json"
    preserve_previous(root, environment)
    write_object(root / relative, data)
    execution.finish([*artifacts, relative])
