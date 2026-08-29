import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "jwsoft-vendor-manifest-"));
const manifestPath = path.join(stage, "vendor-bundle.json");
const writeLock = (version) =>
  fs.writeFileSync(
    path.join(stage, "composer.lock"),
    `${JSON.stringify({ packages: [{ name: "example/runtime", version }] })}\n`,
  );
const generate = (epoch) => {
  execFileSync(
    process.execPath,
    [path.join(root, "scripts/build-vendor-bundle.mjs"), stage, manifestPath],
    {
      env: { ...process.env, SOURCE_DATE_EPOCH: String(epoch) },
      stdio: "ignore",
    },
  );
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
};

try {
  fs.writeFileSync(
    path.join(stage, "composer.json"),
    `${JSON.stringify({ require: { php: "^8.2" } })}\n`,
  );
  fs.writeFileSync(path.join(stage, "vendor-bundle.zip"), "bundle");
  writeLock("1.0.0");

  const first = generate(1_700_000_000);
  const unchanged = generate(1_800_000_000);
  assert.equal(unchanged.generated_at, first.generated_at);

  writeLock("1.0.1");
  const changed = generate(1_900_000_000);
  assert.notEqual(changed.generated_at, first.generated_at);
  assert.equal(changed.generated_at, new Date(1_900_000_000_000).toISOString());
  console.log("[jwsoft] vendor bundle manifest idempotency test passed");
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
