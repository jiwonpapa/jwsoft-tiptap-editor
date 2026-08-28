import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const required = [
  "README.md",
  "CONSTITUTION.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/01-product-brief.md",
  "docs/02-mvp-scope.md",
  "docs/03-architecture.md",
  "docs/04-security.md",
  "docs/05-compatibility.md",
  "docs/06-installation.md",
  "docs/07-development.md",
  "docs/08-testing.md",
  "docs/09-deployment.md",
  "docs/10-release.md",
  "docs/11-work-breakdown.md",
  "docs/acceptance/sirsoft-ckeditor5-parity.md",
];

const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file)))
    errors.push(`필수 문서 누락: ${file}`);
}

const markdownFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      [
        ".git",
        ".build",
        "coverage",
        "dist",
        "node_modules",
        "playwright-report",
        "test-results",
        "vendor",
      ].includes(entry.name)
    )
      continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.name.endsWith(".md")) markdownFiles.push(absolute);
  }
};
walk(root);

const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    let target = match[1].trim().replace(/^<|>$/g, "").split("#")[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    target = decodeURIComponent(target);
    const resolved = path.resolve(path.dirname(file), target);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      errors.push(`${path.relative(root, file)}: 저장소 밖 링크 ${target}`);
    } else if (!fs.existsSync(resolved)) {
      errors.push(`${path.relative(root, file)}: 깨진 링크 ${target}`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `[jwsoft] ERROR: ${error}`).join("\n"));
  process.exit(1);
}
console.log(`[jwsoft] 문서 ${markdownFiles.length}개와 내부 링크 검사 통과`);
