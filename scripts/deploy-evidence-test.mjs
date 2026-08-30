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
  DEPLOY_EVIDENCE_VERSION: "0.1.0-rc.1",
  DEPLOY_EVIDENCE_ARTIFACT: "jwsoft-tiptap-editor-0.1.0-rc.1.zip",
  DEPLOY_EVIDENCE_APP_ENV: "staging",
  DEPLOY_EVIDENCE_TARGET: "test-host:/srv/g7",
  DEPLOY_EVIDENCE_SAME_TARGET_APPROVED: "1",
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
      DEPLOY_EVIDENCE_APP_ENV: "production",
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
  for (const override of [
    { DEPLOY_EVIDENCE_VERSION: "0.1.0-alpha.18" },
    { DEPLOY_EVIDENCE_VERSION: "0.2.0-rc.1" },
    { DEPLOY_EVIDENCE_SAME_TARGET_APPROVED: "0" },
    { DEPLOY_EVIDENCE_TARGET: "" },
  ]) {
    let rejected = false;
    try {
      execFileSync(process.execPath, [script, "verify-production"], {
        env: { ...baseEnv, ...override },
        stdio: "pipe",
      });
    } catch {
      rejected = true;
    }
    if (!rejected)
      throw new Error(`unsafe promotion accepted: ${JSON.stringify(override)}`);
  }
  if (
    !production.sameTargetAsStaging ||
    !production.sameTargetPromotionApproved ||
    !production.stagingEvidenceSha256 ||
    Date.parse(production.appliedAt) <= Date.parse(staging.appliedAt)
  )
    throw new Error("separate same-target promotion proof is missing");
  execFileSync(process.execPath, [script, "record"], {
    env: {
      ...baseEnv,
      DEPLOY_EVIDENCE_ENVIRONMENT: "staging",
      DEPLOY_EVIDENCE_MODE: "update",
    },
    stdio: "pipe",
  });
  if (fs.readdirSync(path.join(outputRoot, "history")).length !== 1)
    throw new Error("previous staging evidence was not preserved");
  console.log("[jwsoft] deploy evidence lifecycle test passed");
} finally {
  fs.rmSync(outputRoot, { recursive: true, force: true });
}
