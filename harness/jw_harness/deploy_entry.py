"""Guarded deployment entrypoint; direct Python invocation cannot bypass release gates."""

import os
import shlex
from pathlib import Path

from .deploy_evidence import finish_deployment, verify_staging
from .deploy_remote import Remote
from .deploy_transaction import archive_manifest, deploy_transaction
from .execution import Execution
from .files import Object, hash_file
from .http import validate_http_url
from .process import run


def deploy_from_environment(root: Path, environment: str, archive: Path, *, apply: bool) -> None:
    if not apply or environment not in ("staging", "production"):
        raise ValueError("Deployment requires an explicit environment and --apply")
    values = dict(os.environ)
    required = (
        "DEPLOY_HOST",
        "G7_REMOTE_ROOT",
        "DEPLOY_MODE",
        "SMOKE_URL",
        "EXPECTED_APP_ENV",
        "REMOTE_ARTIFACT_DIR",
    )
    if any(not values.get(key) for key in required):
        raise ValueError("Deployment environment is incomplete")
    validate_http_url(values["SMOKE_URL"])
    checksum = hash_file(archive)
    version, _ = archive_manifest(archive)
    staging = None
    if environment == "production":
        if values.get("PRODUCTION_APPROVAL") != "jwsoft-tiptap-editor-production":
            raise ValueError("Production confirmation token is missing")
        if values.get("APPROVED_STAGING_SHA256") != checksum:
            raise ValueError("Approved staging checksum mismatch")
        staging = verify_staging(
            root,
            version,
            checksum,
            f"{values['DEPLOY_HOST']}:{values['G7_REMOTE_ROOT']}",
            values.get("SAME_TARGET_PROMOTION_APPROVED") == "1",
        )
    run(["node", "scripts/deployment-gate.mjs", environment, str(archive)], root)
    execution = Execution(
        root, f"test-results/harness/deploy-{environment}.json", f"deploy-{environment}"
    )
    try:
        execute_deployment(execution, environment, archive, values, staging)
    except BaseException:
        execution.fail()
        raise


def execute_deployment(
    execution: Execution,
    environment: str,
    archive: Path,
    values: dict[str, str],
    staging: Object | None,
) -> None:
    root = execution.root
    remote = Remote(
        root,
        values["DEPLOY_HOST"],
        values["G7_REMOTE_ROOT"],
        values["REMOTE_ARTIFACT_DIR"],
        values.get("PHP_BIN", "php"),
        values.get("DEPLOY_RUN_USER", ""),
        execution,
    )
    print(
        remote.script(
            "remote-deploy-preflight.sh",
            [
                remote.root,
                remote.php,
                environment,
                values["EXPECTED_APP_ENV"],
                values["DEPLOY_MODE"],
            ],
        )
    )
    execution.run(
        ["ssh", remote.host, shlex.join(["mkdir", "-p", "--", remote.artifact_dir])],
        label="prepare",
    )
    snapshots = deploy_transaction(
        remote, archive, hash_file(archive), values["DEPLOY_MODE"], values["SMOKE_URL"]
    )
    finish_deployment(execution, environment, archive, values, snapshots, staging)
