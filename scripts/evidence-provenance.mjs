import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const hashFile = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export function evidenceFile(root, relative) {
  const base = fs.realpathSync(root) + path.sep;
  const absolute = path.resolve(base, relative);
  if (
    !absolute.startsWith(base) ||
    !fs.existsSync(absolute) ||
    !fs.realpathSync(absolute).startsWith(base) ||
    !fs.statSync(absolute).isFile()
  ) {
    throw new Error(`missing or out-of-root evidence: ${relative}`);
  }
  return absolute;
}

/** Bind checks to code and package inputs; acceptance-only commits do not invalidate them. */
export function sourceFingerprint(root) {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(
      (file) =>
        /^(resources|src|routes|database|lang|config|policy|scripts|tests)\//.test(
          file,
        ) ||
        /^harness\/(contracts|fixtures)\//.test(file) ||
        file === "NOTICE" ||
        /^(plugin\.php|plugin\.json|components\.json|composer\.(json|lock)|package(-lock)?\.json|vite\.config\.ts|vitest\.config\.ts|playwright\.config\.ts|tsconfig\.json|Makefile|CHANGELOG\.md|LICENSE|THIRD_PARTY_NOTICES\.md|vendor-bundle\.(json|zip))$/.test(
          file,
        ),
    );
  const digest = crypto.createHash("sha256");
  for (const file of [...new Set(files)].sort()) {
    const absolute = path.join(root, file);
    digest
      .update(file)
      .update("\0")
      .update(fs.existsSync(absolute) ? hashFile(absolute) : "missing")
      .update("\0");
  }
  return digest.digest("hex");
}

export function recordCheckEvidence(root) {
  const artifacts = [
    "test-results/parity/unit.json",
    "test-results/parity/corpus.json",
  ];
  const unit = JSON.parse(
    fs.readFileSync(path.join(root, artifacts[0]), "utf8"),
  );
  if (
    unit.success !== true ||
    unit.numTotalTests < 1 ||
    unit.numPassedTests !== unit.numTotalTests
  )
    throw new Error("unit checks did not pass");
  const corpus = JSON.parse(
    fs.readFileSync(path.join(root, artifacts[1]), "utf8"),
  );
  if (corpus.status !== "pass") throw new Error("corpus checks did not pass");
  const result = {
    schemaVersion: 1,
    status: "pass",
    sourceFingerprint: sourceFingerprint(root),
    observedAt: new Date().toISOString(),
    artifacts: Object.fromEntries(
      artifacts.map((file) => [file, hashFile(path.join(root, file))]),
    ),
  };
  fs.writeFileSync(
    path.join(root, "test-results/parity/checks.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
}

if (
  process.argv[1] === import.meta.filename &&
  process.argv[2] === "record-checks"
) {
  recordCheckEvidence(path.resolve(import.meta.dirname, ".."));
  console.log("[jwsoft] check evidence bound to current source inputs");
}
