"""Explicit GitHub channel changes for already verified immutable package bytes."""

import json
import tempfile
from pathlib import Path

from .files import hash_file, object_value
from .process import run


def release_title(tag: str, phase: str) -> str:
    suffix = "검증 후보 · 최종 승인 전" if phase == "candidate" else "검증 완료"
    return f"jw-editor {tag} — {suffix}"


def release_notes(tag: str, head: str, checksum: str, phase: str) -> str:
    notice = (
        "후보 57/57 통과. GitHub 설치·업데이트·제거 및 배포 5개는 검증 전입니다. "
        "Latest는 G7 업데이트 전달 채널이며 최종 승인 완료를 뜻하지 않습니다."
        if phase == "candidate"
        else "최종 62/62 통과. GitHub 설치·업데이트·데이터 보존 제거와 "
        "동일 ZIP의 staging·production 적용을 확인했습니다."
    )
    return (
        f"<!-- jw-editor-release:{phase}:{head}:{checksum} -->\n"
        f"## jw-editor {tag}\n\n{notice}\n\n"
        "G7용 정책 기반 에디터입니다. 설치·지원 범위·업데이트 주의사항은 "
        "저장소 README와 CHANGELOG를 참고하십시오. 기존 글은 수정·저장 시 "
        "서식이 달라질 수 있으며 자동 변환하지 않습니다.\n\n"
        f"Commit: `{head}`\n\nZIP SHA256: `{checksum}`\n"
    )


def verify_tags(root: Path, tag: str, head: str, *, create: bool) -> None:
    local = run(["git", "tag", "--list", tag], root, capture=True)
    remote = run(
        ["git", "ls-remote", "origin", f"refs/tags/{tag}", f"refs/tags/{tag}^{{}}"],
        root,
        capture=True,
    )
    refs = dict((parts[1], parts[0]) for row in remote.splitlines() if (parts := row.split()))
    remote_head = refs.get(f"refs/tags/{tag}^{{}}", refs.get(f"refs/tags/{tag}"))
    if remote_head is not None and remote_head != head:
        raise ValueError("Remote tag differs from the verified commit; no overwrite")
    if local and run(["git", "rev-parse", f"{tag}^{{commit}}"], root, capture=True) != head:
        raise ValueError("Local tag differs from the verified commit; no overwrite")
    if not create and (not local or remote_head != head):
        raise ValueError("Both release tags must already identify the verified commit")
    if create:
        if not local:
            run(["git", "tag", tag, head], root)
        if remote_head is None:
            run(["git", "push", "origin", f"refs/tags/{tag}"], root)


def verify_remote_package(root: Path, tag: str, artifact: Path, checksum: str) -> None:
    with tempfile.TemporaryDirectory(prefix="jw-editor-release-") as directory:
        run(
            ["gh", "release", "download", tag, "--pattern", artifact.name, "--dir", directory],
            root,
        )
        if hash_file(Path(directory) / artifact.name) != checksum:
            raise ValueError("Published candidate bytes differ from the verified deployment ZIP")


def create_candidate(root: Path, tag: str, head: str, artifact: Path, checksum: str) -> None:
    releases = json.loads(
        run(["gh", "release", "list", "--limit", "100", "--json", "tagName"], root, capture=True)
    )
    if not isinstance(releases, list) or any(
        object_value(item).get("tagName") == tag for item in releases
    ):
        raise ValueError("Existing release cannot be overwritten")
    verify_tags(root, tag, head, create=True)
    if hash_file(artifact) != checksum:
        raise ValueError("Release asset changed during verification")
    # gh create also rejects existing releases outside the bounded listing.
    run(
        [
            "gh",
            "release",
            "create",
            tag,
            str(artifact),
            str(root / ".build/SHA256SUMS"),
            "--verify-tag",
            "--latest",
            "--title",
            release_title(tag, "candidate"),
            "--notes",
            release_notes(tag, head, checksum, "candidate"),
        ],
        root,
    )
    verify_remote_package(root, tag, artifact, checksum)


def promote_candidate(root: Path, tag: str, head: str, artifact: Path, checksum: str) -> None:
    metadata = object_value(
        json.loads(
            run(
                ["gh", "release", "view", tag, "--json", "isPrerelease,isDraft,name,body"],
                root,
                capture=True,
            )
        )
    )
    if (
        metadata.get("isPrerelease") is not False
        or metadata.get("isDraft") is not False
        or metadata.get("name") != release_title(tag, "candidate")
        or metadata.get("body") != release_notes(tag, head, checksum, "candidate")
    ):
        raise ValueError("Only the matching ADR-0017 candidate may be promoted; no overwrite")
    verify_remote_package(root, tag, artifact, checksum)
    run(
        [
            "gh",
            "release",
            "edit",
            tag,
            "--latest",
            "--title",
            release_title(tag, "final"),
            "--notes",
            release_notes(tag, head, checksum, "final"),
        ],
        root,
    )
