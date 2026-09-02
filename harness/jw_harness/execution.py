"""Only an owning execution can publish a fresh successful receipt."""

import subprocess
import time
import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path

from .files import Json, Object, hash_file, repository_file, write_object
from .provenance import source_fingerprint


class Execution:
    def __init__(self, root: Path, receipt: str, scope: str) -> None:
        self.root = root
        self.receipt = root / receipt
        self.started_ns = time.time_ns()
        self.fingerprint = source_fingerprint(root)
        self.run_id = uuid.uuid4().hex
        self.directory = root / "test-results/executions" / self.run_id
        self.directory.mkdir(parents=True)
        self.commands: list[Json] = []
        self.failed = False
        self.data: Object = {
            "schemaVersion": 2,
            "status": "running",
            "scope": scope,
            "runId": self.run_id,
            "startedAt": datetime.now(UTC).isoformat(),
            "sourceFingerprint": self.fingerprint,
        }
        write_object(self.receipt, self.data)

    def run(
        self,
        argv: Sequence[str],
        *,
        environment: Mapping[str, str] | None = None,
        cwd: Path | None = None,
    ) -> Path:
        log = self.directory / f"{len(self.commands):03d}.log"
        started = time.monotonic_ns()
        try:
            with log.open("w") as stream:
                result = subprocess.run(  # noqa: S603 -- fixed runner plans, no shell
                    list(argv),
                    cwd=cwd or self.root,
                    stdout=stream,
                    stderr=subprocess.STDOUT,
                    env=environment,
                    timeout=1200,
                    check=False,
                    text=True,
                )
            output = log.read_text()
            if len(output) > 6000:
                output = (
                    f"[jwsoft] Full execution log: {log.relative_to(self.root)}\n" + output[-4000:]
                )
            print(output, end="", flush=True)
            self.commands.append(
                {
                    "argv": list(argv),
                    "cwd": str(cwd or self.root),
                    "exitCode": result.returncode,
                    "durationNs": time.monotonic_ns() - started,
                    "log": str(log.relative_to(self.root)),
                    "logSha256": hash_file(log),
                }
            )
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, list(argv))
            return log
        except BaseException:
            self.fail()
            raise

    def fail(self) -> None:
        self.failed = True
        write_object(self.receipt, {**self.data, "status": "failed", "commands": self.commands})

    def finish(self, artifacts: Sequence[str], **metadata: Json) -> None:
        try:
            if not self.commands or self.failed:
                raise ValueError("Successful executed commands are required")
            if self.fingerprint != source_fingerprint(self.root):
                raise ValueError("Source changed during execution; rerun checks")
            digests: Object = {}
            for relative in artifacts:
                file = repository_file(self.root, relative)
                if file.stat().st_mtime_ns < self.started_ns:
                    raise ValueError(f"Artifact was not produced by this execution: {relative}")
                digests[relative] = hash_file(file)
            write_object(
                self.receipt,
                {
                    **metadata,
                    **self.data,
                    "status": "pass",
                    "commands": self.commands,
                    "finishedAt": datetime.now(UTC).isoformat(),
                    "artifacts": digests,
                },
            )
        except BaseException:
            self.fail()
            raise
