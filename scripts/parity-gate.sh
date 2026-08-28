#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

evidence="$PROJECT_ROOT/test-results/parity/evidence.json"
[ -f "$evidence" ] || fail "동등성 증거가 없습니다: test-results/parity/evidence.json (stable 이전 단계에서는 정상적인 차단입니다.)"

JWSOFT_PARITY_HEAD="$(git -C "$PROJECT_ROOT" rev-parse HEAD)" \
  node --input-type=module - "$PROJECT_ROOT" "$evidence" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const [root, evidencePath] = process.argv.slice(2);
const contract = JSON.parse(fs.readFileSync(path.join(root, 'harness/contracts/ckeditor-parity.json'), 'utf8'));
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const expected = new Set(contract.items.map(({ id }) => id));
const rawResults = evidence.results ?? [];
const results = new Map(rawResults.map((result) => [result.id, result]));
const errors = [];

if (rawResults.length !== results.size) errors.push('중복 evidence id가 있습니다.');

for (const id of expected) {
  const result = results.get(id);
  if (!result) errors.push(`증거 누락: ${id}`);
  else if (result.status !== 'pass') errors.push(`통과하지 못함: ${id} (${result.status ?? 'unknown'})`);
  else if (!Array.isArray(result.artifacts) || result.artifacts.length === 0) errors.push(`artifact 누락: ${id}`);
  else {
    for (const artifact of result.artifacts) {
      const absolute = path.resolve(root, artifact);
      if (!absolute.startsWith(path.resolve(root) + path.sep)) errors.push(`저장소 밖 artifact: ${id} -> ${artifact}`);
      else if (!fs.existsSync(absolute)) errors.push(`artifact 파일 누락: ${id} -> ${artifact}`);
    }
  }
}
for (const id of results.keys()) {
  if (!expected.has(id)) errors.push(`계약에 없는 증거: ${id}`);
}
if (!evidence.g7Version || !evidence.pluginVersion || !evidence.commit) errors.push('버전/커밋 provenance가 없습니다.');
const head = process.env.JWSOFT_PARITY_HEAD;
if (head && evidence.commit !== head) errors.push(`evidence commit 불일치: ${evidence.commit} != ${head}`);
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (evidence.pluginVersion !== plugin.version) errors.push('evidence plugin version이 현재 manifest와 다릅니다.');
if (results.size !== expected.size) errors.push(`evidence 개수 불일치: ${results.size} != ${expected.size}`);
if (errors.length) {
  console.error(errors.map((error) => `[jwsoft] ERROR: ${error}`).join('\n'));
  process.exit(1);
}
console.log(`[jwsoft] CKEditor 대체 동등성 ${expected.size}개 기준 통과`);
NODE
