import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateProductionVersion } from "./release-phases.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outputRoot = process.env.DEPLOY_EVIDENCE_OUTPUT_ROOT
  ? path.resolve(process.env.DEPLOY_EVIDENCE_OUTPUT_ROOT)
  : path.join(root, "test-results/deploy");
const action = process.argv[2];
const checksum = process.env.DEPLOY_EVIDENCE_CHECKSUM ?? "";
const expectedVersion = process.env.DEPLOY_EVIDENCE_VERSION ?? "";
const expectedTarget = process.env.DEPLOY_EVIDENCE_TARGET ?? "";
const fingerprint = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

if (!/^[0-9a-f]{64}$/.test(checksum)) {
  throw new Error("DEPLOY_EVIDENCE_CHECKSUM must be a SHA-256 digest");
}

const readEvidence = (environment) => {
  const file = path.join(outputRoot, `${environment}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`${environment} deploy evidence does not exist`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

const verifyStaging = () => {
  validateProductionVersion(expectedVersion);
  if (!expectedTarget) throw new Error("production target is required");
  const staging = readEvidence("staging");
  if (
    staging.status !== "pass" ||
    staging.environment !== "staging" ||
    staging.artifact?.sha256 !== checksum ||
    staging.pluginVersion !== expectedVersion ||
    !Number.isFinite(Date.parse(staging.appliedAt))
  ) {
    throw new Error("staging deploy evidence does not match the artifact");
  }
  if (
    staging.targetFingerprint === fingerprint(expectedTarget) &&
    process.env.DEPLOY_EVIDENCE_SAME_TARGET_APPROVED !== "1"
  ) {
    throw new Error(
      "same-target staging to production promotion requires explicit approval",
    );
  }
  return staging;
};

if (action === "verify-production") {
  verifyStaging();
  console.log(
    `[jwsoft] production checksum matches staging evidence: ${checksum}`,
  );
  process.exit(0);
}

if (action !== "record") {
  throw new Error("usage: deploy-evidence.mjs record|verify-production");
}

const environment = process.env.DEPLOY_EVIDENCE_ENVIRONMENT ?? "";
const version = process.env.DEPLOY_EVIDENCE_VERSION ?? "";
const artifactName = process.env.DEPLOY_EVIDENCE_ARTIFACT ?? "";
const deployMode = process.env.DEPLOY_EVIDENCE_MODE ?? "";
const appEnvironment = process.env.DEPLOY_EVIDENCE_APP_ENV ?? "";
const target = process.env.DEPLOY_EVIDENCE_TARGET ?? "";
const smokeUrl = process.env.DEPLOY_EVIDENCE_SMOKE_URL ?? "";

if (!new Set(["staging", "production"]).has(environment)) {
  throw new Error("deploy evidence environment must be staging or production");
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("deploy evidence version must be semantic");
}
if (!/^jwsoft-tiptap-editor-[0-9A-Za-z.-]+\.zip$/.test(artifactName)) {
  throw new Error("deploy evidence artifact name is invalid");
}
if (!new Set(["install", "update"]).has(deployMode)) {
  throw new Error("deploy evidence mode must be install or update");
}
if (!/^[A-Za-z0-9._-]+$/.test(appEnvironment)) {
  throw new Error("deploy evidence app environment is invalid");
}
if (target === "" || smokeUrl === "") {
  throw new Error("deploy evidence target and smoke URL are required");
}

let sameAsStaging = null;
let stagingEvidenceSha256 = null;
let sameTargetAsStaging = null;
let stagingAppliedAt = null;
if (environment === "production") {
  const staging = verifyStaging();
  if (Date.now() <= Date.parse(staging.appliedAt))
    throw new Error("production apply must follow staging apply");
  stagingEvidenceSha256 = fingerprint(
    fs.readFileSync(path.join(outputRoot, "staging.json")),
  );
  sameTargetAsStaging = staging.targetFingerprint === fingerprint(target);
  stagingAppliedAt = staging.appliedAt;
  sameAsStaging = true;
}

const evidence = {
  schemaVersion: 2,
  status: "pass",
  environment,
  pluginVersion: version,
  artifact: {
    name: artifactName,
    sha256: checksum,
  },
  deployMode,
  appEnvironment,
  targetFingerprint: fingerprint(target),
  smokeUrlFingerprint: fingerprint(smokeUrl),
  sameAsStaging,
  stagingEvidenceSha256,
  stagingAppliedAt,
  sameTargetAsStaging,
  sameTargetPromotionApproved:
    sameTargetAsStaging === true
      ? process.env.DEPLOY_EVIDENCE_SAME_TARGET_APPROVED === "1"
      : null,
  appliedAt: new Date().toISOString(),
};

fs.mkdirSync(outputRoot, { recursive: true });
const current = path.join(outputRoot, `${environment}.json`);
if (fs.existsSync(current)) {
  const historical = fs.readFileSync(current);
  const archive = path.join(outputRoot, "history");
  fs.mkdirSync(archive, { recursive: true });
  const previous = path.join(
    archive,
    `${environment}-${fingerprint(historical)}.json`,
  );
  if (!fs.existsSync(previous))
    fs.writeFileSync(previous, historical, { flag: "wx" });
}
fs.writeFileSync(current, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`[jwsoft] ${environment} deploy evidence recorded: ${checksum}`);
