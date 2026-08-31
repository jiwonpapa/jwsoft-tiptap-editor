import fs from "node:fs";
import path from "node:path";
import { evidenceFile, hashFile } from "./evidence-provenance.mjs";
import { validateProductionVersion } from "./release-phases.mjs";

const read = (root, file) =>
  JSON.parse(fs.readFileSync(evidenceFile(root, file), "utf8"));
const requireValue = (valid, reason) => {
  if (!valid) throw new Error(reason);
};

export const integrationTests = [
  "tests/integration/g7_middleware_test.php",
  "tests/integration/g7_settings_test.php",
  "tests/integration/g7_admin_security_test.php",
  "tests/integration/g7_image_subsystem_test.php",
  "tests/integration/g7_media_subsystem_test.php",
  "tests/integration/g7_link_preview_test.php",
  "tests/integration/g7_state_sync_test.mjs",
];

const runtimeBrowserFiles = new Set([
  "instance-lifecycle.json",
  "editor-indentation.json",
  "editor-image-layout.json",
  "editor-ime.json",
]);

export function validateMobileLayout(responsive) {
  const {
    viewport,
    toolbarClientWidth,
    toolbarScrollWidth,
    bodyScrollWidth,
    theme,
  } = responsive ?? {};
  requireValue(
    [
      viewport?.width,
      viewport?.height,
      toolbarClientWidth,
      toolbarScrollWidth,
      bodyScrollWidth,
    ].every((value) => Number.isInteger(value) && value > 0),
    "mobile layout measurements are missing",
  );
  requireValue(
    viewport.width <= 480 && viewport.height >= 600 && theme === "dark",
    "mobile dark viewport is outside the supported range",
  );
  requireValue(
    toolbarScrollWidth <= toolbarClientWidth + 1,
    "mobile toolbar must not overflow horizontally",
  );
  requireValue(
    bodyScrollWidth <= viewport.width + 1,
    "mobile page must not overflow horizontally",
  );
}

export function currentPackage(context) {
  const data = read(context.root, "test-results/release/reproducibility.json");
  requireValue(
    /^[0-9a-f]{64}$/.test(data.artifactSha256 ?? ""),
    "reproducible package checksum is missing",
  );
  validateStableArtifact(
    { ...context, artifactSha256: data.artifactSha256 },
    "test-results/release/reproducibility.json",
  );
  return data.artifactSha256;
}

export function validateStableArtifact(context, relative) {
  const { root, version, fingerprint, runtimeSha256, artifactSha256 } = context;
  const data = read(root, relative);
  if (relative.endsWith("/unit.json")) {
    requireValue(
      data.success === true &&
        data.numTotalTests > 0 &&
        data.numPassedTests === data.numTotalTests,
      "unit result did not pass",
    );
  } else requireValue(data.status === "pass", "evidence did not pass");
  const packageMatches = (checksum) =>
    requireValue(
      Boolean(artifactSha256) && checksum === artifactSha256,
      "evidence does not match a current reproducible package",
    );

  if (
    [
      "test-results/parity/unit.json",
      "test-results/parity/corpus.json",
    ].includes(relative)
  ) {
    const checks = read(root, "test-results/parity/checks.json");
    requireValue(
      checks.status === "pass" && checks.sourceFingerprint === fingerprint,
      "check evidence has stale source inputs",
    );
    requireValue(
      checks.artifacts?.[relative] === hashFile(evidenceFile(root, relative)),
      "check result digest mismatch",
    );
  } else if (relative === "test-results/parity/integration.json") {
    requireValue(
      data.sourceFingerprint === fingerprint,
      "integration source inputs are stale",
    );
    requireValue(
      data.checks?.length === integrationTests.length &&
        integrationTests.every((file) =>
          data.checks.some(
            (check) =>
              check.file === file &&
              check.status === "pass" &&
              check.sha256 === hashFile(evidenceFile(root, file)),
          ),
        ),
      "integration coverage or test digest mismatch",
    );
  } else if (relative.startsWith("test-results/parity/browser/")) {
    requireValue(
      data.pluginVersion === version,
      "browser plugin version is stale",
    );
    requireValue(
      /^[0-9a-f]{40}$/.test(data.sourceCommit ?? ""),
      "browser source commit is missing",
    );
    requireValue(
      Number.isFinite(Date.parse(data.observedAt)),
      "browser observation time is missing",
    );
    const filename = path.basename(relative);
    if (runtimeBrowserFiles.has(filename) || filename === "evidence.json") {
      requireValue(
        Boolean(runtimeSha256) && data.runtimeSha256 === runtimeSha256,
        "browser runtime bundle is missing or stale",
      );
    } else packageMatches(data.pluginPackageSha256);
    if (filename === "evidence.json") validateMobileLayout(data.responsive);
    let screenshotCount = 0;
    const visit = (value) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== "object") return;
      if (value.file) {
        requireValue(
          value.sha256 === hashFile(evidenceFile(root, value.file)),
          "browser screenshot digest mismatch",
        );
        screenshotCount += 1;
      } else Object.values(value).forEach(visit);
    };
    visit(data.screenshots);
    if (!runtimeBrowserFiles.has(filename))
      requireValue(screenshotCount > 0, "G7 browser screenshots are missing");
  } else if (relative === "test-results/parity/lifecycle/evidence.json") {
    requireValue(
      data.update?.to === version && data.restored?.version === version,
      "lifecycle version is stale",
    );
    packageMatches(data.update?.artifactSha256);
    requireValue(
      data.rollback?.contentHashesPreserved === true &&
        data.conflictActivationBlocked === true,
      "lifecycle rollback or conflict proof is missing",
    );
  } else if (
    relative === "test-results/parity/github-lifecycle/evidence.json"
  ) {
    requireValue(
      data.install?.version === version &&
        data.update?.to === version &&
        data.restored?.version === version,
      "GitHub lifecycle version is stale",
    );
    packageMatches(data.artifactSha256);
    requireValue(
      data.install?.zipArtifactSha256 === artifactSha256 &&
        data.uninstall?.deleteData === false &&
        data.uninstall?.pluginRecordRemoved === true &&
        data.uninstall?.tablesPreserved === true &&
        data.uninstall?.contentHashesPreserved === true &&
        data.rollback?.contentHashesPreserved === true,
      "GitHub install/uninstall preservation proof is incomplete",
    );
  } else if (relative === "test-results/release/reproducibility.json") {
    requireValue(
      data.version === version &&
        data.sourceFingerprint === fingerprint &&
        data.builds >= 2,
      "reproducibility source/version is stale",
    );
    requireValue(
      Boolean(runtimeSha256) && data.runtimeSha256 === runtimeSha256,
      "reproducible runtime bundle is stale",
    );
    packageMatches(data.artifactSha256);
    requireValue(
      hashFile(evidenceFile(root, data.artifact)) === artifactSha256,
      "reproducible archive digest mismatch",
    );
  } else if (relative === "test-results/release/license.json") {
    requireValue(
      data.artifactChecked === true && data.sourceFingerprint === fingerprint,
      "artifact license check is missing or stale",
    );
    packageMatches(data.artifactSha256);
  } else if (relative === "test-results/parity/supply-chain.json") {
    packageMatches(data.artifactSha256);
    requireValue(
      data.runtimeCdnReferences === 0 &&
        data.reproducibleChecksumVerified === true,
      "supply-chain checks are incomplete",
    );
  } else if (relative.startsWith("test-results/deploy/")) {
    const environment = path.basename(relative, ".json");
    requireValue(
      data.environment === environment && data.pluginVersion === version,
      "deploy role/version mismatch",
    );
    packageMatches(data.artifact?.sha256);
    if (environment === "production") {
      validateProductionVersion(version);
      const staging = read(root, "test-results/deploy/staging.json");
      requireValue(
        staging.status === "pass" &&
          staging.environment === "staging" &&
          staging.pluginVersion === version &&
          staging.artifact?.sha256 === artifactSha256 &&
          data.sameAsStaging === true &&
          data.stagingEvidenceSha256 ===
            hashFile(evidenceFile(root, "test-results/deploy/staging.json")) &&
          Date.parse(data.appliedAt) > Date.parse(staging.appliedAt) &&
          (data.targetFingerprint !== staging.targetFingerprint ||
            (data.sameTargetAsStaging === true &&
              data.sameTargetPromotionApproved === true)),
        "production is not bound to the approved staging artifact",
      );
    }
  } else throw new Error(`no freshness validator for ${relative}`);
  return data;
}
