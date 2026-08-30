import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outputRoot = process.env.DEPLOY_EVIDENCE_OUTPUT_ROOT
  ? path.resolve(process.env.DEPLOY_EVIDENCE_OUTPUT_ROOT)
  : path.join(root, "test-results/deploy");
const action = process.argv[2];
const checksum = process.env.DEPLOY_EVIDENCE_CHECKSUM ?? "";

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
  const staging = readEvidence("staging");
  if (
    staging.status !== "pass" ||
    staging.environment !== "staging" ||
    staging.artifact?.sha256 !== checksum
  ) {
    throw new Error("staging deploy evidence does not match the artifact");
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
if (target === "" || smokeUrl === "") {
  throw new Error("deploy evidence target and smoke URL are required");
}

const fingerprint = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
let sameAsStaging = null;
if (environment === "production") {
  verifyStaging();
  sameAsStaging = true;
}

const evidence = {
  schemaVersion: 1,
  status: "pass",
  environment,
  pluginVersion: version,
  artifact: {
    name: artifactName,
    sha256: checksum,
  },
  deployMode,
  targetFingerprint: fingerprint(target),
  smokeUrlFingerprint: fingerprint(smokeUrl),
  sameAsStaging,
  appliedAt: new Date().toISOString(),
};

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(
  path.join(outputRoot, `${environment}.json`),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(`[jwsoft] ${environment} deploy evidence recorded: ${checksum}`);
