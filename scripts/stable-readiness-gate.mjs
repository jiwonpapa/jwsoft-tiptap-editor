import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hashFile, sourceFingerprint } from "./evidence-provenance.mjs";
import { currentPackage, validateStableArtifact } from "./stable-evidence.mjs";
import { partitionReleaseRows } from "./release-phases.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && !args[0].startsWith("--phase=")))
  throw new Error(
    "usage: stable-readiness-gate.mjs [--phase=candidate|predeploy|production|final]",
  );
const phase = args[0]?.slice("--phase=".length) ?? "final";
const acceptancePath = path.join(
  root,
  "docs/acceptance/sirsoft-ckeditor5-parity.md",
);
const contractPath = path.join(root, "harness/contracts/stable-readiness.json");
const acceptance = fs.readFileSync(acceptancePath, "utf8");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const rows = [...acceptance.matchAll(/^- \[([ x])\] (.+)$/gm)].map((match) => {
  const tagged = match[2].match(/^(.*?)\s+<!-- p0:([a-z0-9.-]+) -->$/);
  if (!tagged) {
    throw new Error(`P0 항목에 evidence ID가 없습니다: ${match[2]}`);
  }
  return {
    checked: match[1] === "x",
    requirement: tagged[1],
    id: tagged[2],
  };
});
if (rows.length === 0) throw new Error("P0 체크리스트가 비어 있습니다.");
if (new Set(rows.map(({ id }) => id)).size !== rows.length) {
  throw new Error("P0 evidence ID가 중복되었습니다.");
}

const coverage = new Map();
for (const item of contract.items ?? []) {
  if (coverage.has(item.id)) {
    throw new Error(`stable coverage ID가 중복되었습니다: ${item.id}`);
  }
  coverage.set(item.id, item);
}
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).version;
const context = {
  root,
  version,
  fingerprint: sourceFingerprint(root),
  runtimeSha256: fs.existsSync(path.join(root, "dist/js/plugin.iife.js"))
    ? hashFile(path.join(root, "dist/js/plugin.iife.js"))
    : null,
  artifactSha256: null,
};
let packageBlocker = null;
try {
  context.artifactSha256 = currentPackage(context);
} catch (error) {
  packageBlocker = error.message;
}
const cleanTree =
  execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  }).trim() === "";
const globalBlockers = cleanTree ? [] : ["Git worktree is not clean"];
const unknownIds = [...coverage.keys()].filter(
  (id) => !rows.some((row) => row.id === id),
);
if (unknownIds.length)
  throw new Error(`체크리스트에 없는 coverage ID: ${unknownIds.join(", ")}`);

const verified = [];
const remaining = [];
const artifactErrors = new Map();
const { required, deferred } = partitionReleaseRows(rows, phase);
for (const row of rows) {
  const item = coverage.get(row.id);
  if (!item) {
    throw new Error(`P0의 coverage 계약이 없습니다: ${row.id}`);
  }
  if (!Array.isArray(item.artifacts) || item.artifacts.length === 0) {
    throw new Error(`stable coverage artifact가 없습니다: ${row.id}`);
  }
  if (!required.includes(row)) continue;
  const reasons = row.checked ? [] : ["acceptance checklist is not approved"];
  for (const artifact of item.artifacts) {
    if (!artifactErrors.has(artifact)) {
      try {
        validateStableArtifact(context, artifact);
        artifactErrors.set(artifact, null);
      } catch (error) {
        artifactErrors.set(artifact, error.message);
      }
    }
    if (artifactErrors.get(artifact))
      reasons.push(`${artifact}: ${artifactErrors.get(artifact)}`);
  }
  if (reasons.length) {
    remaining.push({ id: row.id, requirement: row.requirement, reasons });
    continue;
  }
  verified.push({
    id: row.id,
    requirement: row.requirement,
    gate: item.gate,
    artifacts: item.artifacts,
  });
}

const ready = remaining.length === 0 && globalBlockers.length === 0;
const outputDirectory = path.join(root, "test-results", "release");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(
    outputDirectory,
    phase === "final" ? "stable-readiness.json" : `${phase}-readiness.json`,
  ),
  `${JSON.stringify(
    {
      schemaVersion: 3,
      phase,
      status: ready ? "pass" : "blocked",
      pluginVersion: version,
      sourceFingerprint: context.fingerprint,
      runtimeSha256: context.runtimeSha256,
      artifactSha256: context.artifactSha256,
      packageBlocker,
      cleanTree,
      globalBlockers,
      totalCount: rows.length,
      requiredCount: required.length,
      deferredCount: deferred.length,
      deferred: deferred.map(({ id, requirement }) => ({ id, requirement })),
      verifiedCount: verified.length,
      remainingCount: remaining.length,
      verified,
      remaining,
    },
    null,
    2,
  )}\n`,
);
if (!ready) {
  console.error(
    `[jwsoft] ${phase} gate 차단: 증거 완료 ${verified.length}/${required.length}, 전체 P0 ${rows.length}개, 미검증 ${remaining.length}개\n${remaining
      .map((item) => `- ${item.id}: ${item.reasons.join("; ")}`)
      .concat(globalBlockers.map((reason) => `- ${reason}`))
      .join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `[jwsoft] ${phase} readiness gate 통과: ${verified.length}/${required.length}, 후속 단계 ${deferred.length}개`,
);
