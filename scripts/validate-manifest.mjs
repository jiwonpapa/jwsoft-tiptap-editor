import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const fail = (message) => {
  console.error(`[jwsoft] ERROR: ${message}`);
  process.exitCode = 1;
};

const npmManifest = read("package.json");
const composer = read("composer.json");
const plugin = read("plugin.json");
const components = read("components.json");

const versions = new Set([
  npmManifest.version,
  plugin.version,
  components.version,
]);
if (versions.size !== 1) fail(`버전 불일치: ${[...versions].join(", ")}`);
if (plugin.identifier !== "jwsoft-tiptap-editor")
  fail("plugin identifier가 고정 계약과 다릅니다.");
if (components.identifier !== plugin.identifier)
  fail("components identifier가 plugin과 다릅니다.");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(plugin.identifier))
  fail("plugin identifier 형식이 잘못되었습니다.");
if (plugin.g7_version !== ">=7.0.9") fail("최소 G7 버전은 >=7.0.9여야 합니다.");
if (plugin.assets?.js?.output !== "dist/js/plugin.iife.js")
  fail("IIFE 출력 계약이 다릅니다.");
if (plugin.github_url !== "https://github.com/jiwonpapa/jwsoft-tiptap-editor")
  fail("GitHub URL이 제품 저장소와 다릅니다.");
if (npmManifest.private !== true)
  fail("npm 레지스트리 배포는 허용하지 않습니다.");
if (
  [npmManifest.license, composer.license, plugin.license].some(
    (license) => license !== "Apache-2.0",
  )
)
  fail("제품 라이선스는 Apache-2.0이어야 합니다.");
if (plugin.name.ko !== "jw-editor" || plugin.name.en !== "jw-editor")
  fail("공식 제품명은 jw-editor여야 합니다.");

if (!process.exitCode) console.log("[jwsoft] Manifest 계약 검사 통과");
