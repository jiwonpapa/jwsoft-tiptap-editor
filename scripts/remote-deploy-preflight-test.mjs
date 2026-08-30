import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts/remote-deploy-preflight.sh");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "jwsoft-preflight-"));
const pluginRoot = path.join(fixture, "plugins/jwsoft-tiptap-editor");
const configFile = path.join(fixture, "bootstrap/cache/config.php");
const environmentFile = path.join(fixture, ".env");
let cases = 0;

const run = (environment, expectedAppEnv, mode, errorText = null) => {
  const result = spawnSync(
    "bash",
    [script, fixture, "php", environment, expectedAppEnv, mode],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  if (errorText === null) {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /remote preflight passed/);
  } else {
    assert.notEqual(result.status, 0, result.stdout);
    assert.ok(result.stderr.includes(errorText), result.stderr);
  }
  cases += 1;
};

try {
  for (const directory of [
    "vendor",
    "bootstrap/cache",
    "storage/framework/cache/data",
    "storage/framework/views",
    "storage/logs",
    "plugins",
  ]) {
    fs.mkdirSync(path.join(fixture, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(fixture, "artisan"), "<?php\n");
  fs.writeFileSync(path.join(fixture, "vendor/autoload.php"), "<?php\n");
  fs.writeFileSync(environmentFile, 'APP_ENV="staging"\nAPP_DEBUG=false\n');

  run("staging", "staging", "install");
  run("staging", "testing", "install", "APP_ENV 불일치");
  run("staging", "staging", "update", "DEPLOY_MODE=install");
  run("staging", "staging", "invalid", "install 또는 update");
  run("invalid", "staging", "install", "staging 또는 production");
  run("production", "staging", "install", "APP_ENV=production이어야");

  fs.writeFileSync(environmentFile, "APP_ENV='production'\nAPP_DEBUG=true\n");
  run("production", "production", "install", "APP_DEBUG=false");
  run("staging", "production", "install", "APP_DEBUG=false");
  fs.writeFileSync(environmentFile, "APP_ENV=production\nAPP_DEBUG=false\n");
  run("staging", "staging", "install", "APP_ENV 불일치");
  run("staging", "production", "install");
  run("production", "production", "install");

  fs.writeFileSync(environmentFile, "APP_ENV=staging\nAPP_DEBUG=false\n");
  fs.writeFileSync(
    configFile,
    "<?php return ['app' => ['env' => 'production', 'debug' => true]];\n",
  );
  run("staging", "staging", "install", "APP_ENV 불일치");
  run("production", "production", "install", "APP_DEBUG=false");
  fs.unlinkSync(configFile);

  const pending = path.join(fixture, "plugins/_pending/jwsoft-tiptap-editor");
  fs.mkdirSync(pending, { recursive: true });
  run("staging", "staging", "install", "pending 경로가 있어 덮어쓰지");
  fs.rmdirSync(pending);

  fs.mkdirSync(pluginRoot);
  fs.writeFileSync(path.join(pluginRoot, "plugin.json"), "{}\n");
  run("staging", "staging", "install", "DEPLOY_MODE=update");
  run("staging", "staging", "update");

  const blockedFile = path.join(fixture, "storage/logs/fixture.log");
  fs.writeFileSync(blockedFile, "fixture\n", { mode: 0o444 });
  // Root can write chmod(0444); non-root runs also verify permission rejection.
  if (process.getuid?.() !== 0) {
    run("staging", "staging", "update", "쓰기 권한이 없습니다");
  }
  fs.chmodSync(blockedFile, 0o644);
  fs.rmdirSync(path.join(fixture, "storage/framework/views"));
  run("staging", "staging", "update", "필수 디렉터리가 없습니다");
  fs.mkdirSync(path.join(fixture, "storage/framework/views"));

  fs.rmSync(path.join(fixture, "plugins"), { recursive: true });
  run("staging", "staging", "install", "plugins 디렉터리가 없습니다");
  fs.mkdirSync(path.join(fixture, "plugins"));
  fs.writeFileSync(environmentFile, "APP_ENV=staging\n");
  run("staging", "staging", "install", "APP_DEBUG를 판정할 수 없습니다");

  console.log(`[jwsoft] remote deploy preflight tests passed: ${cases} cases`);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
