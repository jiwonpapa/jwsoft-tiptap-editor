"""Dedicated local lifecycle adapter; reuse production byte and activation assertions."""

from pathlib import Path

from .deploy_transaction import CK, JW, activate_state, archive_manifest, verify_archive
from .execution import Execution
from .files import Object, read_object, write_object


class LifecycleTarget:
    def __init__(self, execution: Execution, host: Path, ids: list[int], directory: Path) -> None:
        self.execution, self.host, self.ids, self.directory = execution, host, ids, directory
        self.snapshots: list[str] = []

    def php(self, script: str, *args: str) -> Object:
        log = self.execution.run(["php", script, str(self.host), *args])
        return read_object(log)

    def state(self) -> Object:
        return self.php("scripts/remote-editor-state.php")

    def command(self, action: str, plugin: str = "") -> None:
        allowed = {
            "plugin:activate",
            "plugin:deactivate",
            "optimize:clear",
            "extension:update-autoload",
        }
        if action not in allowed or plugin not in ("", JW, CK):
            raise ValueError("Unsupported local lifecycle command")
        self.execution.run(
            ["php", "artisan", action, *([plugin] if plugin else []), "--no-interaction"],
            cwd=self.host,
        )

    def install(self, source: Path | str, github: bool = False) -> Object:
        return self.php(
            "tests/integration/g7_remote_plugin_action.php",
            "install-github" if github else "install-zip",
            str(source),
        )

    def update(self, archive: Path | None = None) -> None:
        self.execution.run(
            [
                "php",
                "artisan",
                "plugin:update",
                JW,
                f"--zip={archive}" if archive else "--source=github",
                "--force",
                "--vendor-mode=bundled",
                "--layout-strategy=overwrite",
                "--no-interaction",
            ],
            cwd=self.host,
        )
        if archive:
            verify_archive(self.state(), *archive_manifest(archive))

    def uninstall(self) -> None:
        activate_state(self, False, False)
        self.execution.run(
            ["php", "artisan", "plugin:uninstall", JW, "--force", "--no-interaction"],
            cwd=self.host,
        )
        if self.state().get("jwInstalled") is not False:
            raise ValueError("Uninstall did not remove the plugin registry entry")

    def content(self) -> Object:
        return self.php("tests/integration/g7_content_probe.php", *map(str, self.ids))

    def snapshot(self, name: str, version: str, jw: bool = True) -> Object:
        result = self.php(
            "tests/integration/g7_lifecycle_probe.php",
            version,
            "active" if jw else "inactive",
            "inactive" if jw else "active",
            *map(str, self.ids),
        )
        self.save(name, result)
        return result

    def save(self, name: str, data: Object) -> None:
        path = self.directory / f"{name}.json"
        write_object(path, data)
        self.snapshots.append(str(path.relative_to(self.execution.root)))

    def recover(self, archive: Path, before: Object, content: Object) -> None:
        activate_state(self, False, False)
        if self.state().get("jwInstalled") is True:
            self.update(archive)
        else:
            self.install(archive)
        verify_archive(self.state(), *archive_manifest(archive))
        activate_state(self, before.get("jwActive") is True, before.get("ckActive") is True)
        self.command("optimize:clear")
        if self.content().get("records") != content.get("records"):
            raise ValueError("Recovery did not preserve original content")
