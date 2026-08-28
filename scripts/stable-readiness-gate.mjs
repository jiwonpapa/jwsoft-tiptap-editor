import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const acceptance = fs.readFileSync(
  path.join(root, "docs/acceptance/sirsoft-ckeditor5-parity.md"),
  "utf8",
);
const remaining = [...acceptance.matchAll(/^- \[ \] (.+)$/gm)].map(
  (match) => match[1],
);
const outputDirectory = path.join(root, "test-results", "release");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, "stable-readiness.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: remaining.length === 0 ? "pass" : "blocked",
      remainingCount: remaining.length,
      remaining,
    },
    null,
    2,
  )}\n`,
);
if (remaining.length > 0) {
  console.error(
    `[jwsoft] stable 출시 차단: P0 미완료 ${remaining.length}개\n${remaining
      .map((item) => `- ${item}`)
      .join("\n")}`,
  );
  process.exit(1);
}
console.log("[jwsoft] stable readiness gate 통과");
