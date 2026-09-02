"""Stable publication is a promotion of already deployed bytes, never a rebuild."""

import json
import re
import tempfile
from pathlib import Path

from .files import Object, hash_file, object_value, read_object, repository_file, string_value
from .process import run

APPROVAL = "publish-verified-jw-editor-stable"


def promote_candidate(root: Path, tag: str, artifact: Path, checksum: str) -> None:
    metadata = json.loads(
        run(["gh", "release", "view", tag, "--json", "isPrerelease"], root, capture=True)
    )
    if not isinstance(metadata, dict) or metadata.get("isPrerelease") is not True:
        raise ValueError(
            "Only an existing prerelease may be promoted; no implicit creation/overwrite"
        )
    with tempfile.TemporaryDirectory(prefix="jw-editor-promote-") as directory:
        run(
            ["gh", "release", "download", tag, "--pattern", artifact.name, "--dir", directory], root
        )
        if hash_file(Path(directory) / artifact.name) != checksum:
            raise ValueError("Published candidate bytes differ from the verified deployment ZIP")
    run(["gh", "release", "edit", tag, "--prerelease=false", "--latest"], root)


def validate_final(data: Object, version: str, checksum: str) -> None:
    expected = {
        "phase": "final",
        "status": "pass",
        "pluginVersion": version,
        "artifactSha256": checksum,
        "totalCount": 62,
        "requiredCount": 62,
        "verifiedCount": 62,
        "remainingCount": 0,
        "deferredCount": 0,
        "cleanTree": True,
    }
    if any(data.get(key) != value for key, value in expected.items()):
        raise ValueError("Stable publication requires fresh final 62/62 evidence")
    if data.get("globalBlockers") != [] or data.get("remaining") != []:
        raise ValueError("Stable publication has unresolved blockers")
    verified = data.get("verified")
    if not isinstance(verified, list) or len(verified) != 62:
        raise ValueError("62 unique verified requirements are required")
    ids = {string_value(object_value(item).get("id")) for item in verified}
    if len(ids) != 62 or not {"deploy.staging", "deploy.production-checksum"} <= ids:
        raise ValueError("Deployment requirements or unique evidence IDs are missing")


def publish_stable(root: Path, tag: str, *, apply: bool, approval: str) -> None:
    version = string_value(read_object(root / "package.json")["version"])
    if not re.fullmatch(r"v\d+\.\d+\.\d+", tag) or tag != f"v{version}":
        raise ValueError("Stable tag must exactly match the final package version")
    if apply and approval != APPROVAL:
        raise ValueError(f"Publication requires --approval {APPROVAL}")
    if run(["git", "status", "--porcelain"], root, capture=True):
        raise ValueError("Publication requires a clean worktree")
    # Re-evaluate actual artifacts; an old summary file is never sufficient.
    run(["node", "scripts/stable-readiness-gate.mjs", "--phase=final"], root)
    package = read_object(root / "test-results/release/reproducibility.json")
    artifact = repository_file(root, string_value(package.get("artifact")))
    checksum = hash_file(artifact)
    readiness = read_object(root / "test-results/release/stable-readiness.json")
    validate_final(readiness, version, checksum)
    for role in ("staging", "production"):
        deployed = read_object(root / f"test-results/deploy/{role}.json")
        if object_value(deployed.get("artifact")).get("sha256") != checksum:
            raise ValueError(f"{role} bytes differ from the release asset")
    if not apply:
        print(f"[jwsoft] verified publication plan only: {tag} sha256={checksum}")
        return
    head = run(["git", "rev-parse", "HEAD"], root, capture=True)
    tagged = run(["git", "rev-parse", f"refs/tags/{tag}^{{commit}}"], root, capture=True)
    remote = run(
        ["git", "ls-remote", "origin", f"refs/tags/{tag}", f"refs/tags/{tag}^{{}}"],
        root,
        capture=True,
    )
    if tagged != head or not any(row.split()[0] == head for row in remote.splitlines()):
        raise ValueError("Local and remote release tags must point to the verified commit")
    if hash_file(artifact) != checksum:
        raise ValueError("Release asset changed during verification")
    promote_candidate(root, tag, artifact, checksum)
