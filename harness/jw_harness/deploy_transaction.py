"""Apply and HTTP smoke share one rollback boundary; never invent deployment success."""

import hashlib
import json
import re
import zipfile
from pathlib import Path
from typing import Protocol

from .files import Object, hash_file, object_value, string_value

JW = "jwsoft-tiptap-editor"
CK = "sirsoft-ckeditor5"


class DeploymentTarget(Protocol):
    @property
    def project(self) -> Path: ...
    def state(self) -> Object: ...
    def stage(self, artifact: Path) -> str: ...
    def apply(self, artifact: str, digest: str, mode: str) -> None: ...
    def command(self, action: str, plugin: str = "") -> None: ...
    def smoke(self, url: str) -> None: ...


def archive_manifest(archive: Path) -> tuple[str, Object]:
    files: Object = {}
    with zipfile.ZipFile(archive) as package:
        for entry in package.infolist():
            if entry.is_dir():
                continue
            path = Path(entry.filename)
            if path.is_absolute() or ".." in path.parts or path.parts[0] != JW:
                raise ValueError("Unsafe deployment archive path")
            relative = str(Path(*path.parts[1:]))
            if relative in files:
                raise ValueError("Duplicate deployment archive path")
            files[relative] = hashlib.sha256(package.read(entry)).hexdigest()
        manifest = object_value(json.loads(package.read(f"{JW}/plugin.json")))
    version = string_value(manifest.get("version"))
    if manifest.get("identifier") != JW or not re.fullmatch(r"[0-9A-Za-z.-]+", version):
        raise ValueError("Invalid deployment manifest")
    return version, files


def verify_archive(state: Object, version: str, files: Object) -> None:
    installed = object_value(state.get("files"))
    if state.get("jwVersion") != version or not files:
        raise ValueError("Installed plugin version differs from verified archive")
    if any(installed.get(path) != digest for path, digest in files.items()):
        raise ValueError("Installed plugin files differ from verified archive")


def activate_state(remote: DeploymentTarget, jw: bool, ck: bool) -> None:
    if jw and ck:
        raise ValueError("Two active editors are not an allowed target")
    for key, identifier, wanted in (("jwActive", JW, jw), ("ckActive", CK, ck)):
        if remote.state().get(key) is True and not wanted:
            remote.command("plugin:deactivate", identifier)
    for key, identifier, wanted in (("jwActive", JW, jw), ("ckActive", CK, ck)):
        if remote.state().get(key) is not True and wanted:
            remote.command("plugin:activate", identifier)
    state = remote.state()
    if state.get("jwActive") is not jw or state.get("ckActive") is not ck:
        raise ValueError("Editor activation command did not produce the required state")


def rollback(
    remote: DeploymentTarget, before: Object, previous: tuple[str, str, str, Object] | None
) -> None:
    activate_state(remote, False, False)
    if previous is not None:
        path, digest, version, files = previous
        remote.apply(path, digest, "update")
        verify_archive(remote.state(), version, files)
    activate_state(remote, before.get("jwActive") is True, before.get("ckActive") is True)
    remote.command("optimize:clear")


def deploy_transaction(
    remote: DeploymentTarget, archive: Path, checksum: str, mode: str, smoke_url: str
) -> None:
    if mode not in ("install", "update") or hash_file(archive) != checksum:
        raise ValueError("Invalid deployment mode or checksum")
    version, files = archive_manifest(archive)
    before = remote.state()
    if any(type(before.get(key)) is not bool for key in ("jwActive", "ckActive", "jwInstalled")):
        raise ValueError("Cannot establish pre-deployment editor state")
    if before.get("jwActive") is True and before.get("ckActive") is True:
        raise ValueError("Conflicting active editors; deployment cannot safely infer prior state")
    if (before.get("jwInstalled") is True) != (mode == "update"):
        raise ValueError("Deployment mode differs from installed state")
    previous = None
    if mode == "update":
        prior_version = string_value(before.get("jwVersion"))
        if not re.fullmatch(r"[0-9A-Za-z.-]+", prior_version):
            raise ValueError("Unsafe prior version")
        prior = remote.project / ".build" / f"{JW}-{prior_version}.zip"
        old_version, old_files = archive_manifest(prior)
        verify_archive(before, old_version, old_files)
        previous = (remote.stage(prior), hash_file(prior), old_version, old_files)
    current = remote.stage(archive)
    try:
        remote.apply(current, checksum, mode)
        activate_state(remote, True, False)
        remote.command("optimize:clear")
        verify_archive(remote.state(), version, files)
        remote.smoke(smoke_url)
    except BaseException as original:
        try:
            rollback(remote, before, previous)
            remote.smoke(smoke_url)
        except BaseException as recovery:
            raise RuntimeError(
                "CRITICAL: deployment failed and recovery/state/HTTP verification failed"
            ) from recovery
        raise RuntimeError(
            "Deployment failed; prior bytes and editor state restored; no pass evidence"
        ) from original
