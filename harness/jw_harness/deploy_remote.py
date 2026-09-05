"""Small SSH transport; application behavior remains in fixed tracked scripts."""

import json
import re
import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .execution import Execution
from .files import Object, object_value
from .http import validate_http_url
from .process import run


@dataclass(frozen=True)
class Remote:
    project: Path
    host: str
    root: str
    artifact_dir: str
    php: str = "php"
    user: str = ""
    execution: Execution | None = None

    def __post_init__(self) -> None:
        for value in (self.host, self.root, self.php, self.artifact_dir):
            if not re.fullmatch(r"[A-Za-z0-9._/@:+-]+", value) or value.startswith("-"):
                raise ValueError("Unsafe remote argument")
        if self.user and not re.fullmatch(r"[a-z_][a-z0-9_-]*", self.user):
            raise ValueError("Unsafe remote user")

    def script(self, filename: str, argv: list[str], *, php: bool = False) -> str:
        source = (self.project / "scripts" / filename).read_text()
        command = ["sudo", "-n", "-u", self.user, "--"] if self.user else []
        command += (
            [self.php, "-r", source.removeprefix("<?php"), "--", *argv]
            if php
            else ["bash", "-s", "--", *argv]
        )
        ssh = shutil.which("ssh")
        if ssh is None:
            raise ValueError("SSH executable is missing")
        if self.execution is not None:
            log = self.execution.run(
                [ssh, self.host, shlex.join(command)],
                input_text=None if php else source,
                label=filename,
                display=False,
            )
            return log.read_text()
        result = subprocess.run(  # noqa: S603 -- resolved SSH executable and quoted argv
            [ssh, self.host, shlex.join(command)],
            cwd=self.project,
            input=None if php else source,
            text=True,
            capture_output=True,
            check=True,
            timeout=600,
        )
        return result.stdout

    def state(self) -> Object:
        return object_value(
            json.loads(self.script("remote-editor-state.php", [self.root], php=True))
        )

    def stage(self, artifact: Path) -> str:
        if not re.fullmatch(r"[A-Za-z0-9._-]+\.zip", artifact.name):
            raise ValueError("Unsafe artifact filename")
        target = f"{self.artifact_dir}/{artifact.name}"
        self.execute(["rsync", "-a", "--checksum", str(artifact), f"{self.host}:{target}"], "stage")
        return target

    def apply(self, artifact: str, digest: str, mode: str) -> None:
        print(self.script("remote-deploy-apply.sh", [self.root, self.php, mode, artifact, digest]))

    def command(self, action: str, plugin: str = "") -> None:
        print(self.script("remote-editor-command.sh", [self.root, self.php, action, plugin]))

    def smoke(self, url: str) -> None:
        validate_http_url(url)
        self.execute(
            [
                "curl",
                "--fail",
                "--silent",
                "--show-error",
                "--location",
                "--proto",
                "=http,https",
                "--proto-redir",
                "=http,https",
                "--max-time",
                "20",
                "--output",
                "/dev/null",
                "--",
                url,
            ],
            "smoke",
        )

    def execute(self, argv: list[str], label: str) -> None:
        if self.execution is None:
            run(argv, self.project)
        else:
            self.execution.run(argv, label=label)
