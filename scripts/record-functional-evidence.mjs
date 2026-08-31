import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  hashFile,
  sourceFingerprint,
  evidenceFile,
} from "./evidence-provenance.mjs";
import { validateFunctionalAudit } from "./stable-evidence.mjs";

const root = path.resolve(import.meta.dirname, "..");
if (process.argv.length !== 3)
  throw new Error(
    "usage: record-functional-evidence.mjs <fresh-observations.json>",
  );
const input = JSON.parse(
  fs.readFileSync(evidenceFile(root, process.argv[2]), "utf8"),
);
const version = JSON.parse(
  fs.readFileSync(path.join(root, "plugin.json"), "utf8"),
).version;
const runtimeSha256 = hashFile(path.join(root, "dist/js/plugin.iife.js"));
const pluginPackageSha256 = hashFile(
  path.join(root, `.build/jwsoft-tiptap-editor-${version}.zip`),
);
if (
  input.runtimeSha256 !== runtimeSha256 ||
  input.pluginPackageSha256 !== pluginPackageSha256 ||
  input.pluginVersion !== version ||
  !Number.isFinite(Date.parse(input.observedAt))
)
  throw new Error(
    "actual tested installation does not match current candidate",
  );
validateFunctionalAudit(input);
if (!Array.isArray(input.screenshots) || input.screenshots.length < 4)
  throw new Error("fresh upload/player/URL screenshots required");
const output = {
  ...input,
  schemaVersion: 1,
  status: "pass",
  sourceFingerprint: sourceFingerprint(root),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  screenshots: input.screenshots.map((file) => ({
    file,
    sha256: hashFile(evidenceFile(root, file)),
  })),
};
const target = path.join(
  root,
  "test-results/parity/browser/functional-audit.json",
);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(output, null, 2) + "\n");
console.log("[jwsoft] actual functional audit bound to tested candidate");
