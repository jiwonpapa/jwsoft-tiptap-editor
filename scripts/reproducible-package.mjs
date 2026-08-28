import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const artifact = path.join(
  root,
  `.build/jwsoft-tiptap-editor-${pkg.version}.zip`,
);
const epoch = execFileSync("git", ["log", "-1", "--format=%ct"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const build = () => {
  execFileSync("make", ["package"], {
    cwd: root,
    env: { ...process.env, SOURCE_DATE_EPOCH: epoch },
    stdio: "inherit",
  });
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(artifact))
    .digest("hex");
};

const checksums = [build(), build()];
if (new Set(checksums).size !== 1) {
  throw new Error(`package is not reproducible: ${checksums.join(" != ")}`);
}
const evidence = {
  schemaVersion: 1,
  status: "pass",
  version: pkg.version,
  sourceDateEpoch: Number(epoch),
  builds: checksums.length,
  artifact: path.relative(root, artifact),
  artifactSha256: checksums[0],
};
const outputDirectory = path.join(root, "test-results", "release");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, "reproducibility.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(`[jwsoft] reproducible package 통과: ${checksums[0]}`);
