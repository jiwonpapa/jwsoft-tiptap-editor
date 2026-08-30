import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts/deploy-evidence.mjs");
const outputRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "jwsoft-deploy-evidence-"),
);
const checksum = "a".repeat(64);
const baseEnv = {
  ...process.env,
  DEPLOY_EVIDENCE_OUTPUT_ROOT: outputRoot,
  DEPLOY_EVIDENCE_CHECKSUM: checksum,
  DEPLOY_EVIDENCE_VERSION: "0.1.0-alpha.18",
  DEPLOY_EVIDENCE_ARTIFACT: "jwsoft-tiptap-editor-0.1.0-alpha.18.zip",
  DEPLOY_EVIDENCE_TARGET: "test-host:/srv/g7",
  DEPLOY_EVIDENCE_SMOKE_URL: "https://example.invalid/smoke",
};

try {
  execFileSync(process.execPath, [script, "record"], {
    env: {
      ...baseEnv,
      DEPLOY_EVIDENCE_ENVIRONMENT: "staging",
      DEPLOY_EVIDENCE_MODE: "install",
    },
    stdio: "pipe",
  });
  execFileSync(process.execPath, [script, "verify-production"], {
    env: baseEnv,
    stdio: "pipe",
  });
  execFileSync(process.execPath, [script, "record"], {
    env: {
      ...baseEnv,
      DEPLOY_EVIDENCE_ENVIRONMENT: "production",
      DEPLOY_EVIDENCE_MODE: "update",
    },
    stdio: "pipe",
  });

  const staging = JSON.parse(
    fs.readFileSync(path.join(outputRoot, "staging.json"), "utf8"),
  );
  const production = JSON.parse(
    fs.readFileSync(path.join(outputRoot, "production.json"), "utf8"),
  );
  if (
    staging.status !== "pass" ||
    staging.artifact.sha256 !== checksum ||
    production.sameAsStaging !== true ||
    production.artifact.sha256 !== checksum
  ) {
    throw new Error("deploy evidence lifecycle assertion failed");
  }

  let mismatchRejected = false;
  try {
    execFileSync(process.execPath, [script, "verify-production"], {
      env: { ...baseEnv, DEPLOY_EVIDENCE_CHECKSUM: "b".repeat(64) },
      stdio: "pipe",
    });
  } catch {
    mismatchRejected = true;
  }
  if (!mismatchRejected) {
    throw new Error("production mismatch must be rejected");
  }
  console.log("[jwsoft] deploy evidence lifecycle test passed");
} finally {
  fs.rmSync(outputRoot, { recursive: true, force: true });
}
