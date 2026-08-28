import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(import.meta.dirname, "..");
const schema = JSON.parse(
  fs.readFileSync(path.join(root, "policy/editor-policy.schema.json"), "utf8"),
);
const policy = JSON.parse(
  fs.readFileSync(path.join(root, "policy/editor-policy.json"), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

if (!validate(policy)) {
  console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  process.exit(1);
}

const forbiddenElements = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "form",
  "input",
  "button",
]);
const forbiddenAttributes = /^(?:id|style|srcdoc|on[a-z]+|data-.+)$/i;

for (const [element, definition] of Object.entries(policy.elements)) {
  if (forbiddenElements.has(element))
    throw new Error(`금지 element가 정책에 있습니다: ${element}`);
  for (const attribute of definition.attributes) {
    if (forbiddenAttributes.test(attribute))
      throw new Error(
        `금지 attribute가 정책에 있습니다: ${element}.${attribute}`,
      );
  }
}
for (const attribute of policy.globalAttributes) {
  if (forbiddenAttributes.test(attribute))
    throw new Error(`금지 global attribute가 정책에 있습니다: ${attribute}`);
}

const tokens = Object.values(policy.classTokens).flat();
if (new Set(tokens).size !== tokens.length)
  throw new Error("class token이 중복됩니다.");
if (
  policy.urls.linkSchemes.includes("javascript") ||
  policy.media.schemes.includes("data")
) {
  throw new Error("실행 가능하거나 inline media scheme은 허용할 수 없습니다.");
}
if (policy.urls.allowedLinkHosts.length || policy.media.allowedHosts.length) {
  throw new Error(
    "환경별 host 허용값은 배포 설정에서 보강하며 제품 기본 정책은 비어 있어야 합니다.",
  );
}

console.log("[jwsoft] Editor policy schema/semantic 검사 통과");
