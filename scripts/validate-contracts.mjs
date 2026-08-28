import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = [
  "harness/contracts/g7-surfaces.json",
  "harness/contracts/ckeditor-parity.json",
];

for (const file of files) {
  const contract = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  if (contract.schemaVersion !== 1)
    throw new Error(`${file}: schemaVersion은 1이어야 합니다.`);
  if (!Array.isArray(contract.items) || contract.items.length === 0)
    throw new Error(`${file}: items가 비어 있습니다.`);
  const ids = contract.items.map(({ id }) => id);
  if (ids.some((id) => !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id)))
    throw new Error(`${file}: 잘못된 id가 있습니다.`);
  if (new Set(ids).size !== ids.length)
    throw new Error(`${file}: 중복 id가 있습니다.`);
}

const fixtures = [
  "harness/fixtures/security-corpus.json",
  "harness/fixtures/legacy-html.json",
];
for (const file of fixtures) {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  if (!Array.isArray(fixture.cases) || fixture.cases.length === 0)
    throw new Error(`${file}: cases가 비어 있습니다.`);
  if (new Set(fixture.cases.map(({ id }) => id)).size !== fixture.cases.length)
    throw new Error(`${file}: case id가 중복됩니다.`);
}

console.log("[jwsoft] 통합 계약과 fixture 검사 통과");
