import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
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
const readArtifact = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    throw new Error(`stable evidence가 없습니다: ${relative}`);
  }
  const evidence = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (relative.endsWith("/unit.json")) {
    if (
      evidence.success !== true ||
      evidence.numTotalTests < 1 ||
      evidence.numPassedTests !== evidence.numTotalTests
    ) {
      throw new Error(`unit evidence가 통과하지 않았습니다: ${relative}`);
    }
  } else if (evidence.status !== "pass") {
    throw new Error(`stable evidence가 통과하지 않았습니다: ${relative}`);
  }
  return evidence;
};

const verified = [];
for (const row of rows.filter(({ checked }) => checked)) {
  const item = coverage.get(row.id);
  if (!item) {
    throw new Error(`완료 P0의 coverage 계약이 없습니다: ${row.id}`);
  }
  if (!Array.isArray(item.artifacts) || item.artifacts.length === 0) {
    throw new Error(`stable coverage artifact가 없습니다: ${row.id}`);
  }
  for (const artifact of item.artifacts) readArtifact(artifact);
  verified.push({
    id: row.id,
    requirement: row.requirement,
    gate: item.gate,
    artifacts: item.artifacts,
  });
}

const remaining = rows
  .filter(({ checked }) => !checked)
  .map(({ id, requirement }) => ({ id, requirement }));
const outputDirectory = path.join(root, "test-results", "release");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, "stable-readiness.json"),
  `${JSON.stringify(
    {
      schemaVersion: 2,
      status: remaining.length === 0 ? "pass" : "blocked",
      totalCount: rows.length,
      verifiedCount: verified.length,
      remainingCount: remaining.length,
      verified,
      remaining,
    },
    null,
    2,
  )}\n`,
);
if (remaining.length > 0) {
  console.error(
    `[jwsoft] stable 출시 차단: 증거 완료 ${verified.length}/${rows.length}, P0 미완료 ${remaining.length}개\n${remaining
      .map((item) => `- ${item.id}: ${item.requirement}`)
      .join("\n")}`,
  );
  process.exit(1);
}
console.log(`[jwsoft] stable readiness gate 통과: ${verified.length}개`);
