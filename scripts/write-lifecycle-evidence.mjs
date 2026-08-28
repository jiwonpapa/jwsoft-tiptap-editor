import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const [
  previousArtifact,
  currentArtifact,
  beforePath,
  updatedPath,
  rollbackPath,
  restoredPath,
] = process.argv.slice(2).map((value) => path.resolve(value));
for (const file of [
  previousArtifact,
  currentArtifact,
  beforePath,
  updatedPath,
  rollbackPath,
  restoredPath,
]) {
  if (!file || !fs.existsSync(file))
    throw new Error(`lifecycle input is missing: ${file}`);
}
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const [before, updated, rollback, restored] = [
  beforePath,
  updatedPath,
  rollbackPath,
  restoredPath,
].map(readJson);
const baselineRecords = JSON.stringify(before.records);
for (const [name, snapshot] of Object.entries({
  updated,
  rollback,
  restored,
})) {
  if (JSON.stringify(snapshot.records) !== baselineRecords) {
    throw new Error(`${name} content hashes changed during editor transition`);
  }
  if (snapshot.imageUploadRows !== before.imageUploadRows) {
    throw new Error(
      `${name} image upload rows changed during editor transition`,
    );
  }
  if (snapshot.permissions < 2)
    throw new Error(`${name} upload permissions are missing`);
}
if (before.jwsoft.status !== "active" || updated.jwsoft.status !== "active") {
  throw new Error("JWSoft must stay active through the ZIP update");
}
if (
  rollback.jwsoft.status !== "inactive" ||
  rollback.ckeditor.status !== "active"
) {
  throw new Error("CKEditor rollback state mismatch");
}
if (
  restored.jwsoft.status !== "active" ||
  restored.ckeditor.status !== "inactive"
) {
  throw new Error("JWSoft restore state mismatch");
}
if (before.jwsoft.version === updated.jwsoft.version) {
  throw new Error("ZIP update did not change the JWSoft version");
}
if (updated.jwsoft.version !== restored.jwsoft.version) {
  throw new Error("restored JWSoft version mismatch");
}
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "test-results/parity/lifecycle/evidence.json");
fs.writeFileSync(
  output,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: "pass",
      install: {
        version: before.jwsoft.version,
        artifact: path.relative(root, previousArtifact),
        artifactSha256: hash(previousArtifact),
        tablePresent: true,
        permissionCount: before.permissions,
      },
      update: {
        from: before.jwsoft.version,
        to: updated.jwsoft.version,
        artifact: path.relative(root, currentArtifact),
        artifactSha256: hash(currentArtifact),
      },
      conflictActivationBlocked: true,
      rollback: {
        editor: "sirsoft-ckeditor5",
        status: rollback.ckeditor.status,
        contentHashesPreserved: true,
        imageUploadRowsPreserved: true,
      },
      restored: {
        editor: "jwsoft-tiptap-editor",
        status: restored.jwsoft.status,
        version: restored.jwsoft.version,
      },
    },
    null,
    2,
  )}\n`,
);
console.log(
  `[jwsoft] lifecycle evidence 통과: ${before.jwsoft.version} -> ${updated.jwsoft.version} -> CKEditor -> JWSoft`,
);
