"""Fixed 57/62 publication gates. Never rebuild or promote unexecuted evidence."""

import re
from pathlib import Path

from .files import ROOT, Object, hash_file, object_value, read_object, repository_file, string_value
from .process import run
from .release_remote import create_candidate, promote_candidate, verify_tags

APPROVAL = "publish-verified-jw-editor-stable"
CANDIDATE_APPROVAL = "publish-verified-jw-editor-candidate"
DEFERRED = {
    "lifecycle.install-sources",
    "lifecycle.github-update",
    "lifecycle.uninstall",
    "deploy.staging",
    "deploy.production-checksum",
}


def validate_readiness(data: Object, version: str, checksum: str, phase: str) -> None:
    if phase not in ("candidate", "final"):
        raise ValueError("Unknown publication phase")
    count = 57 if phase == "candidate" else 62
    expected = {
        "phase": phase,
        "status": "pass",
        "pluginVersion": version,
        "artifactSha256": checksum,
        "totalCount": 62,
        "requiredCount": count,
        "verifiedCount": count,
        "remainingCount": 0,
        "deferredCount": 62 - count,
        "cleanTree": True,
    }
    if any(data.get(key) != value for key, value in expected.items()):
        raise ValueError(f"Publication requires fresh {phase} {count}/{count} evidence")
    if data.get("globalBlockers") != [] or data.get("remaining") != []:
        raise ValueError("Stable publication has unresolved blockers")
    verified = data.get("verified")
    if not isinstance(verified, list) or len(verified) != count:
        raise ValueError("Unique verified requirements are required")
    items = read_object(ROOT / "harness/contracts/stable-readiness.json")["items"]
    if not isinstance(items, list):
        raise ValueError("Missing acceptance contract")
    required = {string_value(object_value(item).get("id")) for item in items}
    if phase == "candidate":
        required -= DEFERRED
    ids = {string_value(object_value(item).get("id")) for item in verified}
    if len(ids) != count or ids != required:
        raise ValueError("Required acceptance IDs are missing or replaced")


def validate_final(data: Object, version: str, checksum: str) -> None:
    validate_readiness(data, version, checksum, "final")


def publication_gate(
    root: Path, tag: str, phase: str, *, apply: bool, approval: str
) -> tuple[Path, str, str]:
    required_approval = CANDIDATE_APPROVAL if phase == "candidate" else APPROVAL
    if apply and approval != required_approval:
        raise ValueError(f"Publication requires --approval {required_approval}")
    version = string_value(read_object(root / "package.json")["version"])
    if not re.fullmatch(r"v\d+\.\d+\.\d+", tag) or tag != f"v{version}":
        raise ValueError("Stable tag must exactly match the final package version")
    if run(["git", "status", "--porcelain"], root, capture=True):
        raise ValueError("Publication requires a clean worktree")
    # Re-evaluate actual artifacts; an old summary file is never sufficient.
    run(["node", "scripts/stable-readiness-gate.mjs", f"--phase={phase}"], root)
    package = read_object(root / "test-results/release/reproducibility.json")
    artifact = repository_file(root, string_value(package.get("artifact")))
    checksum = hash_file(artifact)
    name = "candidate-readiness" if phase == "candidate" else "stable-readiness"
    validate_readiness(
        read_object(root / f"test-results/release/{name}.json"), version, checksum, phase
    )
    head = run(["git", "rev-parse", "HEAD"], root, capture=True)
    remote = run(["git", "ls-remote", "origin", "refs/heads/main"], root, capture=True)
    if remote.split() != [head, "refs/heads/main"]:
        raise ValueError("Publication requires the verified public main commit")
    return artifact, checksum, head


def publish_candidate(root: Path, tag: str, *, apply: bool, approval: str) -> None:
    artifact, checksum, head = publication_gate(
        root, tag, "candidate", apply=apply, approval=approval
    )
    if not apply:
        print(f"[jwsoft] candidate Latest plan only (not final approval): {tag} sha256={checksum}")
        return
    create_candidate(root, tag, head, artifact, checksum)


def publish_stable(root: Path, tag: str, *, apply: bool, approval: str) -> None:
    artifact, checksum, head = publication_gate(root, tag, "final", apply=apply, approval=approval)
    for role in ("staging", "production"):
        deployed = read_object(root / f"test-results/deploy/{role}.json")
        if object_value(deployed.get("artifact")).get("sha256") != checksum:
            raise ValueError(f"{role} bytes differ from the release asset")
    verify_tags(root, tag, head, create=False)
    if hash_file(artifact) != checksum:
        raise ValueError("Release asset changed during verification")
    if not apply:
        print(f"[jwsoft] verified publication plan only: {tag} sha256={checksum}")
        return
    promote_candidate(root, tag, head, artifact, checksum)
