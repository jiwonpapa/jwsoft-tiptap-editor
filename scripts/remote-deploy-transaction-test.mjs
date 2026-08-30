import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const deploy = fs.readFileSync(path.join(root, "scripts/deploy.sh"), "utf8");
const remote = deploy.split("<<'REMOTE'\n")[1]?.split("\nREMOTE")[0];
assert.ok(remote, "remote deployment transaction must exist");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "jwsoft-transaction-"));
const app = path.join(fixture, "g7");
const source = path.join(fixture, "source");
const archive = path.join(fixture, "plugin.zip");
const php = path.join(fixture, "php");
const commandLog = path.join(fixture, "commands.log");
const readyState = path.join(fixture, "ready");

try {
  fs.mkdirSync(app);
  fs.mkdirSync(path.join(source, "jwsoft-tiptap-editor"), { recursive: true });
  fs.writeFileSync(
    path.join(source, "jwsoft-tiptap-editor/plugin.json"),
    '{"identifier":"jwsoft-tiptap-editor"}\n',
  );
  execFileSync("zip", ["-qr", archive, "jwsoft-tiptap-editor"], {
    cwd: source,
  });
  const checksum = crypto
    .createHash("sha256")
    .update(fs.readFileSync(archive))
    .digest("hex");
  fs.writeFileSync(
    php,
    `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$JW_TEST_COMMAND_LOG"
if [ "$1" = "-r" ]; then
  test "$(cat "$JW_TEST_READY_FILE")" = "1"
  exit $?
fi
if [ "$2" = "plugin:install" ]; then
  test -f plugins/_pending/jwsoft-tiptap-editor/plugin.json
  mv plugins/_pending/jwsoft-tiptap-editor plugins/jwsoft-tiptap-editor
fi
if [ "$2" = "plugin:list" ]; then
  echo jwsoft-tiptap-editor
fi
if [ "$2" = "plugin:activate" ] && [ "$3" = "jwsoft-tiptap-editor" ]; then
  if [ "$JW_TEST_ACTIVATE_EXIT" = "0" ] && [ "$JW_TEST_NOOP" = "0" ]; then printf 1 > "$JW_TEST_READY_FILE"; fi
  exit "$JW_TEST_ACTIVATE_EXIT"
fi
`,
    { mode: 0o755 },
  );
  const run = (
    mode,
    digest,
    activationSucceeds = true,
    alreadyActive = false,
    noOp = false,
  ) => {
    fs.writeFileSync(commandLog, "");
    fs.writeFileSync(readyState, alreadyActive ? "1" : "0");
    return spawnSync("bash", ["-s", "--", app, php, mode, archive, digest], {
      input: remote,
      encoding: "utf8",
      env: {
        ...process.env,
        JW_TEST_COMMAND_LOG: commandLog,
        JW_TEST_ACTIVATE_EXIT: activationSucceeds ? "0" : "1",
        JW_TEST_READY_FILE: readyState,
        JW_TEST_NOOP: noOp ? "1" : "0",
      },
    });
  };

  let result = run("install", "0".repeat(64));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /checksum 불일치/);
  assert.equal(fs.readFileSync(commandLog, "utf8"), "");

  const pending = path.join(app, "plugins/_pending/jwsoft-tiptap-editor");
  fs.mkdirSync(pending, { recursive: true });
  fs.writeFileSync(path.join(pending, "keep.txt"), "user-owned\n");
  result = run("install", checksum);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /pending 경로가 있어 덮어쓰지/);
  assert.equal(
    fs.readFileSync(path.join(pending, "keep.txt"), "utf8"),
    "user-owned\n",
  );
  assert.equal(fs.readFileSync(commandLog, "utf8"), "");
  fs.rmSync(pending, { recursive: true });

  result = run("install", checksum);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /수정 후 저장할 때/);
  assert.ok(
    fs.existsSync(path.join(app, "plugins/jwsoft-tiptap-editor/plugin.json")),
  );
  assert.match(
    fs.readFileSync(commandLog, "utf8"),
    /plugin:activate jwsoft-tiptap-editor/,
  );

  result = run("update", checksum);
  assert.equal(result.status, 0, result.stderr);
  const commands = fs.readFileSync(commandLog, "utf8");
  assert.ok(
    commands.indexOf("plugin:deactivate sirsoft-ckeditor5") <
      commands.indexOf("plugin:activate jwsoft-tiptap-editor"),
  );
  result = run("update", checksum, false);
  assert.notEqual(result.status, 0);
  const failedCommands = fs.readFileSync(commandLog, "utf8");
  assert.ok(
    failedCommands.indexOf("plugin:deactivate jwsoft-tiptap-editor") >
      failedCommands.indexOf("plugin:activate jwsoft-tiptap-editor"),
  );
  assert.ok(
    failedCommands.indexOf("plugin:activate sirsoft-ckeditor5") >
      failedCommands.indexOf("plugin:deactivate jwsoft-tiptap-editor"),
  );
  result = run("update", checksum, false, true);
  assert.equal(
    result.status,
    0,
    "already active editor must not trigger rollback",
  );
  assert.ok(
    !fs
      .readFileSync(commandLog, "utf8")
      .includes("artisan plugin:activate jwsoft-tiptap-editor"),
  );
  result = run("update", checksum, true, false, true);
  assert.notEqual(
    result.status,
    0,
    "successful command without active state must fail closed",
  );
  console.log("[jwsoft] remote deployment transaction tests passed: 7 cases");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
