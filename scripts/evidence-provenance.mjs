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
  return execFileSync(
    process.env.HARNESS_PYTHON ?? "python3",
    ["-m", "harness.jw_harness", "fingerprint", "--root", root],
    { cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8" },
  ).trim();
}

export function recordCheckEvidence() {
  throw new Error(
    "Retired: check evidence requires make check execution; no restamping.",
  );
}

if (
  process.argv[1] === import.meta.filename &&
  process.argv[2] === "record-checks"
) {
  recordCheckEvidence();
}
