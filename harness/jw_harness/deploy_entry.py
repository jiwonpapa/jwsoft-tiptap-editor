"""Guarded deployment entrypoint; direct Python invocation cannot bypass release gates."""

import os
import shlex
from pathlib import Path

from .deploy_remote import Remote
from .deploy_transaction import archive_manifest, deploy_transaction
from .files import hash_file
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
    checksum = hash_file(archive)
    version, _ = archive_manifest(archive)
    if environment == "production":
        if values.get("PRODUCTION_APPROVAL") != "jwsoft-tiptap-editor-production":
            raise ValueError("Production confirmation token is missing")
        if values.get("APPROVED_STAGING_SHA256") != checksum:
            raise ValueError("Approved staging checksum mismatch")
        values.update(
            {
                "DEPLOY_EVIDENCE_CHECKSUM": checksum,
                "DEPLOY_EVIDENCE_VERSION": version,
                "DEPLOY_EVIDENCE_TARGET": f"{values['DEPLOY_HOST']}:{values['G7_REMOTE_ROOT']}",
                "DEPLOY_EVIDENCE_SAME_TARGET_APPROVED": values.get(
                    "SAME_TARGET_PROMOTION_APPROVED", "0"
                ),
            }
        )
        run(["node", "scripts/deploy-evidence.mjs", "verify-production"], root, environment=values)
    run(["node", "scripts/deployment-gate.mjs", environment, str(archive)], root)
    remote = Remote(
        root,
        values["DEPLOY_HOST"],
        values["G7_REMOTE_ROOT"],
        values["REMOTE_ARTIFACT_DIR"],
        values.get("PHP_BIN", "php"),
        values.get("DEPLOY_RUN_USER", ""),
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
    run(["ssh", remote.host, shlex.join(["mkdir", "-p", "--", remote.artifact_dir])], root)
    deploy_transaction(remote, archive, checksum, values["DEPLOY_MODE"], values["SMOKE_URL"])
