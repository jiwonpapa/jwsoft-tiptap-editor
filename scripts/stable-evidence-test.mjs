import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import {
  evidenceFile,
  hashFile,
  recordCheckEvidence,
  sourceFingerprint,
} from "./evidence-provenance.mjs";
import {
  currentPackage,
  integrationTests,
  validateMobileLayout,
  validateStableArtifact,
  validateFunctionalAudit,
  validateDocumentAppearance,
} from "./stable-evidence.mjs";

test("document presentation proof rejects matching-but-broken and mismatched styles", () => {
  const styles = {
    h2: { fontSize: "26.4px" },
    h3: { fontSize: "21.6px" },
    h4: { fontSize: "18.4px" },
    "span.jw-color-blue": {
      color: "rgb(29, 78, 216)",
      backgroundColor: "rgb(254, 240, 138)",
    },
    "p.jw-text-lg": { fontSize: "18px", lineHeight: "36px" },
    "ul.jw-task-list": { listStyleType: "none", paddingInlineStart: "0px" },
    "td.jw-cell-middle": {
      verticalAlign: "middle",
      borderTopColor: "rgba(0, 0, 0, 0)",
    },
    hr: { borderTopWidth: "1px" },
  };
  const data = {
    themes: ["light", "dark"].map((theme) => ({
      theme,
      editor: structuredClone(styles),
      content: structuredClone(styles),
    })),
  };
  validateDocumentAppearance(data);
  assert.throws(() => validateDocumentAppearance({}), /missing/);
  const mismatch = structuredClone(data);
  mismatch.themes[1].content.h2.fontSize = "16px";
  assert.throws(() => validateDocumentAppearance(mismatch), /differs/);
  for (const theme of data.themes) {
    theme.editor["span.jw-color-blue"].color = "rgb(32, 36, 43)";
    theme.content["span.jw-color-blue"].color = "rgb(32, 36, 43)";
  }
  assert.throws(() => validateDocumentAppearance(data), /not rendered/);
});

test("actual functional audit rejects missing or non-playing media evidence", () => {
  const data = {
    observations: {
      multilingual: { rapidSwitchSavedBoth: true, productId: 101 },
      emptyBody: { rejectedRequests: 18, contentHashesPreserved: true },
      images: {
        public: { postId: 1, loadedWidth: 640, savedAndReopened: true },
        admin: { postId: 1, loadedWidth: 640, savedAndReopened: true },
        invalidRejected: true,
        retryRejected: true,
      },
      mp4: {
        postId: 2,
        filename: "clip.mp4",
        controls: true,
        duration: 12,
        timeBefore: 0,
        timeAfter: 5,
        rangeStatus: 206,
      },
      urls: {
        typedYoutubeCount: 1,
        socialCardCount: 1,
        savedAndReopened: true,
        failedOriginalLinkCount: 1,
        failedCardCount: 0,
      },
    },
  };
  validateFunctionalAudit(data);
  assert.throws(() => validateFunctionalAudit({}), /multilingual/);
  data.observations.mp4.timeAfter = 0;
  assert.throws(() => validateFunctionalAudit(data), /playback/);
  data.observations.mp4.timeAfter = 5;
  data.observations.urls.failedCardCount = 1;
  assert.throws(() => validateFunctionalAudit(data), /URL/);
});

function fixture(run) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "jwsoft-stable-evidence-")),
  );
  const write = (file, value) => {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(
      absolute,
      typeof value === "string" ? value : JSON.stringify(value),
    );
    return absolute;
  };
  const read = (file) =>
    JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const context = {
    root,
    version: "0.1.0-alpha.21",
    fingerprint: "f".repeat(64),
    runtimeSha256: "b".repeat(64),
    artifactSha256: "a".repeat(64),
  };
  const browser = {
    status: "pass",
    pluginVersion: context.version,
    sourceCommit: "c".repeat(40),
    observedAt: "2026-08-30T00:00:00Z",
    runtimeSha256: context.runtimeSha256,
  };
  const responsive = {
    viewport: { width: 412, height: 800 },
    theme: "dark",
    toolbarClientWidth: 390,
    toolbarScrollWidth: 390,
    bodyScrollWidth: 412,
  };
  try {
    run({ root, write, read, context, browser, responsive });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("runtime proof alone is insufficient; stale bundle and missing provenance fail", () =>
  fixture(({ context, write, browser }) => {
    const file = "test-results/parity/browser/editor-ime.json";
    write(file, browser);
    assert.throws(
      () => validateStableArtifact(context, file),
      /execution|browser-ui/i,
    );
    write(file, { ...browser, runtimeSha256: "c".repeat(64) });
    assert.throws(
      () => validateStableArtifact(context, file),
      /runtime bundle/,
    );
    write(file, {
      ...browser,
      runtimeSha256: undefined,
      pluginPackageSha256: context.artifactSha256,
    });
    assert.throws(
      () => validateStableArtifact(context, file),
      /runtime bundle/,
    );
    write(file, { ...browser, observedAt: undefined });
    assert.throws(
      () => validateStableArtifact(context, file),
      /observation time/,
    );
  }));

test("an older browser version cannot pass even with a matching runtime", () =>
  fixture(({ context, write, browser }) => {
    const file = "test-results/parity/browser/editor-ime.json";
    write(file, { ...browser, pluginVersion: "0.1.0-alpha.18" });
    assert.throws(
      () => validateStableArtifact(context, file),
      /version is stale/,
    );
  }));

test("G7 surface proof requires the current package, not only a matching JS bundle", () =>
  fixture(({ context, write, browser }) => {
    const file = "test-results/parity/browser/public-board.json";
    const screenshot = "test-results/parity/browser/board.png";
    const screenshots = [
      {
        file: screenshot,
        sha256: hashFile(
          write(
            screenshot,
            "synthetic screenshot fixture, not release evidence",
          ),
        ),
      },
    ];
    write(file, {
      ...browser,
      screenshots,
      pluginPackageSha256: context.artifactSha256,
    });
    assert.throws(
      () => validateStableArtifact(context, file),
      /execution|browser-|integration/i,
    );
    assert.throws(
      () => validateStableArtifact({ ...context, artifactSha256: null }, file),
      /current reproducible package/,
    );
    write(file, {
      ...browser,
      screenshots,
      pluginPackageSha256: "d".repeat(64),
    });
    assert.throws(
      () => validateStableArtifact(context, file),
      /current reproducible package/,
    );
  }));

test("modified, missing, and absent screenshots cannot pass", () =>
  fixture(({ context, write, browser }) => {
    const file = "test-results/parity/browser/public-board.json";
    const screenshot = "test-results/parity/browser/board.png";
    const absolute = write(screenshot, "test screenshot");
    const proof = {
      ...browser,
      pluginPackageSha256: context.artifactSha256,
      screenshots: [{ file: screenshot, sha256: hashFile(absolute) }],
    };
    write(file, proof);
    write(screenshot, "changed screenshot");
    assert.throws(
      () => validateStableArtifact(context, file),
      /screenshot digest mismatch/,
    );
    fs.unlinkSync(absolute);
    assert.throws(
      () => validateStableArtifact(context, file),
      /missing or out-of-root/,
    );
    write(file, { ...proof, screenshots: [] });
    assert.throws(
      () => validateStableArtifact(context, file),
      /screenshots are missing/,
    );
  }));

test("evidence file paths cannot traverse or follow symlinks outside the fixture", () =>
  fixture(({ root, write }) => {
    const file = write("proof.json", "fixture");
    assert.equal(evidenceFile(root, "proof.json"), file);
    assert.throws(() => evidenceFile(root, "../proof.json"), /out-of-root/);
    fs.symlinkSync(os.tmpdir(), path.join(root, "outside"));
    assert.throws(() => evidenceFile(root, "outside"), /out-of-root/);
  }));

test("mobile folding accepts no overflow and rejects the previous horizontal-scroll UI", () =>
  fixture(({ responsive }) => {
    validateMobileLayout(responsive);
    assert.throws(
      () => validateMobileLayout({ ...responsive, toolbarScrollWidth: 600 }),
      /toolbar must not overflow/,
    );
    assert.throws(
      () => validateMobileLayout({ ...responsive, bodyScrollWidth: 500 }),
      /page must not overflow/,
    );
    assert.throws(
      () => validateMobileLayout({ ...responsive, theme: "light" }),
      /mobile dark viewport/,
    );
    assert.throws(
      () => validateMobileLayout({ ...responsive, bodyScrollWidth: undefined }),
      /measurements are missing/,
    );
  }));

test("current mobile G7 proof needs actual layout measurements and screenshots", () =>
  fixture(({ context, write, browser, responsive }) => {
    const file = "test-results/parity/browser/evidence.json";
    const screenshot = "test-results/parity/browser/mobile.png";
    const proof = {
      ...browser,
      responsive,
      screenshots: [
        { file: screenshot, sha256: hashFile(write(screenshot, "fixture")) },
      ],
    };
    write(file, proof);
    assert.throws(
      () => validateStableArtifact(context, file),
      /execution|browser-|integration/i,
    );
    write(file, {
      ...proof,
      responsive: { ...responsive, toolbarScrollWidth: 800 },
    });
    assert.throws(
      () => validateStableArtifact(context, file),
      /toolbar must not overflow/,
    );
  }));

test("standalone check recorder cannot restamp existing passing results", () =>
  fixture(({ root, write }) => {
    write("test-results/parity/unit.json", {
      success: true,
      numTotalTests: 1,
      numPassedTests: 1,
    });
    write("test-results/parity/corpus.json", { status: "pass" });
    assert.throws(() => recordCheckEvidence(root), /Retired/);
  }));

test("untracked inputs, deleted tracked code and packaged text change the fingerprint", () =>
  fixture(({ root, write }) => {
    execFileSync("git", ["init", "--quiet", root]);
    const file = write("src/fixture.php", "original");
    execFileSync("git", ["add", "src/fixture.php"], { cwd: root });
    const original = sourceFingerprint(root);
    fs.unlinkSync(file);
    assert.notEqual(sourceFingerprint(root), original);
    write("src/fixture.php", "original");
    assert.equal(sourceFingerprint(root), original);
    write("src/new.php", "untracked source");
    const newSource = sourceFingerprint(root);
    assert.notEqual(newSource, original);
    write("CHANGELOG.md", "packaged text");
    assert.notEqual(sourceFingerprint(root), newSource);
  }));

test("all declared unique current G7 checks are required", () =>
  fixture(({ context, write }) => {
    const file = "test-results/parity/integration.json";
    const checks = integrationTests.map((testFile) => ({
      file: testFile,
      status: "pass",
      sha256: hashFile(write(testFile, testFile)),
    }));
    const proof = {
      status: "pass",
      sourceFingerprint: context.fingerprint,
      checks,
    };
    write(file, proof);
    assert.throws(
      () => validateStableArtifact(context, file),
      /execution|browser-|integration/i,
    );
    write(file, { ...proof, checks: Array(6).fill(checks[0]) });
    assert.throws(
      () => validateStableArtifact(context, file),
      /coverage or test digest/,
    );
    write(file, proof);
    write(checks[0].file, "modified test");
    assert.throws(
      () => validateStableArtifact(context, file),
      /coverage or test digest/,
    );
  }));

test("lifecycle rejects old versions, old archives and missing preservation proof", () =>
  fixture(({ context, write }) => {
    const file = "test-results/parity/lifecycle/evidence.json";
    const proof = {
      status: "pass",
      update: { to: context.version, artifactSha256: context.artifactSha256 },
      restored: { version: context.version },
      rollback: { contentHashesPreserved: true },
      conflictActivationBlocked: true,
    };
    write(file, proof);
    validateStableArtifact(context, file);
    write(file, { ...proof, restored: { version: "0.1.0-alpha.18" } });
    assert.throws(
      () => validateStableArtifact(context, file),
      /version is stale/,
    );
    write(file, {
      ...proof,
      update: { ...proof.update, artifactSha256: "d".repeat(64) },
    });
    assert.throws(
      () => validateStableArtifact(context, file),
      /current reproducible package/,
    );
    write(file, { ...proof, conflictActivationBlocked: false });
    assert.throws(
      () => validateStableArtifact(context, file),
      /rollback or conflict/,
    );
  }));

test("package provenance requires current inputs, bundle and unchanged ZIP bytes", () =>
  fixture(({ context, write }) => {
    const file = "test-results/release/reproducibility.json";
    const artifact = ".build/test.zip";
    const artifactSha256 = hashFile(write(artifact, "synthetic archive"));
    const proof = {
      status: "pass",
      version: context.version,
      sourceFingerprint: context.fingerprint,
      runtimeSha256: context.runtimeSha256,
      builds: 2,
      artifact,
      artifactSha256,
    };
    write(file, proof);
    assert.equal(currentPackage(context), artifactSha256);
    assert.throws(
      () => currentPackage({ ...context, fingerprint: "different" }),
      /source\/version is stale/,
    );
    assert.throws(
      () => currentPackage({ ...context, runtimeSha256: "different" }),
      /runtime bundle is stale/,
    );
    write(artifact, "changed archive");
    assert.throws(() => currentPackage(context), /archive digest mismatch/);
  }));

test("source-only license checks do not authorize a package", () =>
  fixture(({ context, write }) => {
    const file = "test-results/release/license.json";
    const proof = {
      status: "pass",
      artifactChecked: true,
      sourceFingerprint: context.fingerprint,
      artifactSha256: context.artifactSha256,
    };
    write(file, proof);
    validateStableArtifact(context, file);
    write(file, { ...proof, artifactChecked: false });
    assert.throws(
      () => validateStableArtifact(context, file),
      /artifact license check/,
    );
  }));

test("production evidence requires matching staging role, version and archive", () =>
  fixture(({ context, write }) => {
    context.version = "0.1.0-rc.1";
    const stagingFile = "test-results/deploy/staging.json";
    const productionFile = "test-results/deploy/production.json";
    const proof = {
      status: "pass",
      environment: "production",
      pluginVersion: context.version,
      artifact: { sha256: context.artifactSha256 },
      sameAsStaging: true,
      targetFingerprint: "e".repeat(64),
      appliedAt: "2026-08-30T01:00:00Z",
      sameTargetAsStaging: true,
      sameTargetPromotionApproved: true,
    };
    write(productionFile, proof);
    assert.throws(
      () => validateStableArtifact(context, productionFile),
      /missing/,
    );
    const staging = {
      ...proof,
      environment: "staging",
      appliedAt: "2026-08-30T00:00:00Z",
    };
    proof.stagingEvidenceSha256 = hashFile(write(stagingFile, staging));
    write(productionFile, proof);
    validateStableArtifact(context, productionFile);
    for (const override of [
      { sameTargetPromotionApproved: false },
      { appliedAt: staging.appliedAt },
      { stagingEvidenceSha256: "f".repeat(64) },
    ]) {
      write(productionFile, { ...proof, ...override });
      assert.throws(() => validateStableArtifact(context, productionFile));
    }
    write(productionFile, proof);
    write(stagingFile, {
      ...proof,
      environment: "staging",
      artifact: { sha256: "d".repeat(64) },
    });
    assert.throws(
      () => validateStableArtifact(context, productionFile),
      /approved staging artifact/,
    );
    write(stagingFile, { ...proof, environment: "production" });
    assert.throws(
      () => validateStableArtifact(context, productionFile),
      /approved staging artifact/,
    );
  }));
