import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    throw new Error(`release candidate evidence 누락: ${relative}`);
  }
  const value = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (value.status !== "pass") {
    throw new Error(`release candidate evidence 실패: ${relative}`);
  }
  return value;
};

const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

const files = {
  parity: "test-results/parity/evidence.json",
  lifecycle: "test-results/parity/lifecycle/evidence.json",
  supplyChain: "test-results/parity/supply-chain.json",
  reproducibility: "test-results/release/reproducibility.json",
  license: "test-results/release/license.json",
};
const data = Object.fromEntries(
  Object.entries(files).map(([name, relative]) => [name, read(relative)]),
);
const sha256 = data.supplyChain.artifactSha256;
if (
  data.parity.pluginVersion !== packageJson.version ||
  data.lifecycle.update?.to !== packageJson.version ||
  data.reproducibility.version !== packageJson.version ||
  data.lifecycle.update?.artifactSha256 !== sha256 ||
  data.reproducibility.artifactSha256 !== sha256 ||
  data.parity.artifactSha256 !== sha256 ||
  data.license.artifactChecked !== true ||
  data.lifecycle.rollback?.contentHashesPreserved !== true
) {
  throw new Error(
    "release candidate version/checksum/lifecycle evidence 불일치",
  );
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (data.parity.commit !== commit) {
  throw new Error("release candidate parity commit 불일치");
}
execFileSync(
  process.execPath,
  [path.join(root, "scripts/stable-readiness-gate.mjs"), "--phase=candidate"],
  { cwd: root, stdio: "inherit" },
);

const output = {
  schemaVersion: 1,
  status: "pass",
  scopePhase: "candidate",
  version: packageJson.version,
  commit,
  artifact: data.supplyChain.artifact,
  artifactSha256: sha256,
  packageBuildsCompared: data.reproducibility.builds,
  productLicense: data.license.productLicense,
  transition: {
    from: data.lifecycle.update.from,
    to: data.lifecycle.update.to,
    rollbackEditor: data.lifecycle.rollback.editor,
    restoredEditor: data.lifecycle.restored.editor,
    contentHashesPreserved: true,
  },
  scope: {
    environment: "dedicated-local-g7",
    browserEvidenceVersion:
      data.parity.evidenceBoundaries?.browser?.pluginVersion,
    packageLifecycleVersion:
      data.parity.evidenceBoundaries?.packageLifecycle?.pluginVersion,
    actualStagingApplied: false,
    productionApplied: false,
    publicReleaseCreated: false,
  },
  artifacts: Object.values(files),
};
if (
  !output.scope.browserEvidenceVersion ||
  output.scope.packageLifecycleVersion !== packageJson.version
) {
  throw new Error("release candidate evidence boundary 누락");
}
const target = path.join(root, "test-results/release/candidate.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `[jwsoft] release candidate evidence 통과 (배포 승인 아님): ${output.version} ${sha256}`,
);
