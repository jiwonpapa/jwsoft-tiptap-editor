"""Own install/update/uninstall/rollback executions with verified recovery on failure."""

from collections.abc import Callable
from pathlib import Path

from .deploy_transaction import activate_state, archive_manifest, verify_archive
from .execution import Execution
from .files import Object, hash_file, read_object, string_value, write_object
from .host import validate_host
from .lifecycle_target import LifecycleTarget
from .process import run

REPOSITORY = "https://github.com/jiwonpapa/jwsoft-tiptap-editor"


def preserved(before: Object, after: Object) -> None:
    for key in ("records", "imageUploadRows", "mediaUploadRows", "mediaSessionRows"):
        if key in before and before.get(key) != after.get(key):
            raise ValueError(f"Lifecycle changed {key}")
    permissions = after.get("permissions", 2)
    if not isinstance(permissions, int) or permissions < 2:
        raise ValueError("Lifecycle lost upload permissions")


def transitions(target: LifecycleTarget, version: str, baseline: Object) -> None:
    activate_state(target, False, True)
    preserved(baseline, target.snapshot("rollback", version, False))
    activate_state(target, True, False)
    target.command("optimize:clear")
    target.command("extension:update-autoload")
    preserved(baseline, target.snapshot("restored", version))


def zip_lifecycle(target: LifecycleTarget, previous: Path, current: Path) -> Object:
    old, version = archive_manifest(previous)[0], archive_manifest(current)[0]
    target.update(previous)
    before = target.snapshot("before", old)
    target.update(current)
    preserved(before, target.snapshot("updated", version))
    conflict = target.php("tests/integration/g7_editor_conflict_test.php")
    if conflict != {"blocked": True, "statePreserved": True}:
        raise ValueError("Conflict refusal was not verified")
    target.save("conflict", conflict)
    transitions(target, version, before)
    return {
        "install": {
            "version": old,
            "artifactSha256": hash_file(previous),
            "tablePresent": True,
            "permissionCount": before["permissions"],
        },
        "update": {"from": old, "to": version, "artifactSha256": hash_file(current)},
        "conflictActivationBlocked": True,
        "rollback": {
            "editor": "sirsoft-ckeditor5",
            "status": "active",
            "contentHashesPreserved": True,
            "imageUploadRowsPreserved": True,
        },
        "restored": {"editor": "jwsoft-tiptap-editor", "status": "active", "version": version},
    }


def github_lifecycle(target: LifecycleTarget, previous: Path, current: Path) -> Object:
    root = target.execution.root
    commit = run(["git", "rev-parse", "HEAD"], root, capture=True)
    remote = run(["git", "ls-remote", REPOSITORY + ".git", "refs/heads/main"], root, capture=True)
    if remote.split()[0] != commit:
        raise ValueError("Public main must exactly match the verified checkout")
    old, version = archive_manifest(previous)[0], archive_manifest(current)[0]
    baseline = target.content()
    target.save("baseline", baseline)
    installed: Object = {}
    for name, source in (("zip", str(current)), ("github", REPOSITORY)):
        target.uninstall()
        uninstalled = target.content()
        preserved(baseline, uninstalled)
        target.save(f"{name}-uninstalled", uninstalled)
        installed = target.install(source, github=name == "github")
        verify_archive(target.state(), *archive_manifest(current))
        target.save(f"{name}-install", installed)
        activate_state(target, True, False)
        preserved(baseline, target.snapshot(f"{name}-active", version))
    target.update(previous)
    target.snapshot("previous", old)
    target.update()
    verify_archive(target.state(), *archive_manifest(current))
    preserved(baseline, target.snapshot("updated", version))
    transitions(target, version, baseline)
    return {
        "repository": REPOSITORY,
        "branch": "main",
        "remoteCommit": commit,
        "install": {
            "sources": ["zip", "github"],
            "version": version,
            "zipArtifactSha256": hash_file(current),
            "runtimeHashes": installed["runtimeHashes"],
        },
        "update": {"from": old, "to": version, "source": "github"},
        "uninstall": {
            "deleteData": False,
            "pluginRecordRemoved": True,
            "tablesPreserved": True,
            "contentHashesPreserved": True,
        },
        "rollback": {"editor": "sirsoft-ckeditor5", "contentHashesPreserved": True},
        "restored": {"editor": "jwsoft-tiptap-editor", "version": version},
        "artifactSha256": hash_file(current),
    }


def guarded_lifecycle(
    target: LifecycleTarget, current: Path, action: Callable[[], Object]
) -> Object:
    content = target.content()  # Also rejects a non-local/non-disposable DB before writes.
    before = target.state()
    verify_archive(before, *archive_manifest(current))
    if before.get("jwActive") is not True or before.get("ckActive") is not False:
        raise ValueError("Lifecycle requires current JW active and CK inactive")
    try:
        return action()
    except BaseException as original:
        try:
            target.recover(current, before, content)
        except BaseException as recovery:
            raise RuntimeError(
                "CRITICAL: lifecycle failed and recovery verification failed"
            ) from recovery
        raise RuntimeError(
            "Lifecycle failed; prior bytes and editor state restored; no pass"
        ) from original


def run_lifecycle(
    root: Path,
    host: Path,
    previous: Path,
    ids: list[int],
    *,
    github: bool,
    explicit_current: Path | None = None,
) -> None:
    host, previous = host.resolve(strict=True), previous.resolve(strict=True)
    validate_host(root, host)
    if len(ids) != 3 or min(ids) < 1:
        raise ValueError("Three positive fixture record IDs required")
    version = string_value(read_object(root / "package.json")["version"])
    current = root / ".build" / f"jwsoft-tiptap-editor-{version}.zip"
    if explicit_current and explicit_current.resolve(strict=True) != current.resolve(strict=True):
        raise ValueError("Explicit current ZIP differs from the canonical package path")
    if archive_manifest(previous)[0] == version or archive_manifest(current)[0] != version:
        raise ValueError("Lifecycle requires distinct previous and current verified versions")
    scope = "github-lifecycle" if github else "lifecycle"
    execution = Execution(root, f"test-results/harness/{scope}.json", scope)
    directory = root / "test-results/parity" / scope
    target = LifecycleTarget(execution, host, ids, directory)
    action = github_lifecycle if github else zip_lifecycle
    try:
        data = guarded_lifecycle(target, current, lambda: action(target, previous, current))
        evidence = directory / "evidence.json"
        write_object(
            evidence,
            {
                **data,
                "schemaVersion": 2,
                "status": "pass",
                "executionRunId": execution.run_id,
                "sourceFingerprint": execution.fingerprint,
            },
        )
        validate_host(root, host)
        execution.finish([*target.snapshots, str(evidence.relative_to(root))])
    except BaseException:
        execution.fail()
        raise
