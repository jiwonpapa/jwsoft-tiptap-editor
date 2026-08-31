import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import prettier from "prettier";

const root = path.resolve(import.meta.dirname, "..");
const policyPath = path.join(root, "policy/editor-policy.json");
const policySource = fs.readFileSync(policyPath, "utf8");
const policy = JSON.parse(policySource);
const policyHash = crypto
  .createHash("sha256")
  .update(policySource)
  .digest("hex");
const checkOnly = process.argv.includes("--check");

const allowedTags = Object.keys(policy.elements);
const allowedAttributes = [
  ...new Set([
    ...policy.globalAttributes,
    ...Object.values(policy.elements).flatMap(({ attributes }) => attributes),
  ]),
].sort();
const classTokens = [
  ...new Set(Object.values(policy.classTokens).flat()),
].sort();

const domPurifyConfig = {
  ALLOWED_TAGS: allowedTags,
  ALLOWED_ATTR: allowedAttributes,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  FORBID_ATTR: ["id", "style"],
};

const tokenCss = `
.jw-text-sm { font-size: 0.875rem; }
.jw-text-base { font-size: 1rem; }
.jw-text-lg { font-size: 1.125rem; }
.jw-text-xl { font-size: 1.25rem; }
.jw-align-left { text-align: left; }
.jw-align-center { text-align: center; }
.jw-align-right { text-align: right; }
.jw-align-justify { text-align: justify; }
${policy.classTokens.inlineSize.map((token) => `.${token} { font-size: ${token.split("-").at(-1)}px; }`).join("\n")}
.jw-color-gray { color: #64748b; }
.jw-color-red { color: #b91c1c; }
.jw-color-orange { color: #c2410c; }
.jw-color-green { color: #15803d; }
.jw-color-blue { color: #1d4ed8; }
.jw-color-purple { color: #7e22ce; }
.jw-highlight-yellow { background-color: #fef08a; color: #20242b; }
.jw-highlight-green { background-color: #bbf7d0; color: #20242b; }
.jw-highlight-blue { background-color: #bfdbfe; color: #20242b; }
.jw-highlight-pink { background-color: #fbcfe8; color: #20242b; }
.jw-highlight-purple { background-color: #e9d5ff; color: #20242b; }
.jw-task-list { list-style: none; padding-inline-start: 0; }
.jw-task-item { position: relative; padding-inline-start: 1.75em; }
.jw-task-item::before { content: '☐'; position: absolute; inset-inline-start: 0; }
.jw-task-checked::before { content: '☑'; }
.jw-task-checked > p { color: #64748b; text-decoration: line-through; }
.jw-cell-gray { background-color: #f1f5f9; color: #20242b; }
.jw-cell-blue { background-color: #dbeafe; color: #20242b; }
.jw-cell-green { background-color: #dcfce7; color: #20242b; }
.jw-cell-yellow { background-color: #fef9c3; color: #20242b; }
.jw-cell-pink { background-color: #fce7f3; color: #20242b; }
.jw-cell-top { vertical-align: top; }
.jw-cell-middle { vertical-align: middle; }
.jw-cell-bottom { vertical-align: bottom; }
.jw-table-bordered td, .jw-table-bordered th { border: 1px solid #cbd5e1; }
.jw-table-borderless td, .jw-table-borderless th { border-color: transparent; }
.jw-indent-1 { margin-inline-start: 2rem; }
.jw-indent-2 { margin-inline-start: 4rem; }
.jw-indent-3 { margin-inline-start: 6rem; }
.jw-indent-4 { margin-inline-start: 8rem; }
.jw-space-tight { line-height: 1.35; }
.jw-space-normal { line-height: 1.7; }
.jw-space-relaxed { line-height: 2; }
.jw-table { width: 100%; border-collapse: collapse; }
.jw-table-striped tbody tr:nth-child(odd) { background: rgb(249 250 251); }
.jw-image-inline { display: inline-block; }
.jw-image-block { display: block; margin-inline: auto; }
.jw-image { display: block; max-width: 100%; margin-block: 1rem; }
.jw-image > img { display: block; width: 100%; max-width: 100%; height: auto; }
.jw-image > figcaption { margin-top: 0.5rem; color: #6b7280; font-size: 0.875rem; line-height: 1.5; text-align: center; overflow-wrap: anywhere; }
.jw-image-align-left { margin-inline: 0 auto; }
.jw-image-align-center { margin-inline: auto; }
.jw-image-align-right { margin-inline: auto 0; }
.jw-image-size-25 { width: 25%; }
.jw-image-size-50 { width: 50%; }
.jw-image-size-75 { width: 75%; }
.jw-image-size-100 { width: 100%; }
${policy.classTokens.image
  .filter(
    (token) =>
      /^jw-image-size-/.test(token) &&
      !["25", "50", "75", "100"].includes(token.split("-").at(-1)),
  )
  .map((token) => `.${token} { width: ${token.split("-").at(-1)}%; }`)
  .join("\n")}
.jw-image-rounded, .jw-image-rounded > img { border-radius: 0.5rem; }
.jw-media { position: relative; width: min(100%, 60rem); margin: 1rem auto; overflow: hidden; border-radius: 0.625rem; background: #111827; color: #fff; }
.jw-media-16x9 { aspect-ratio: 16 / 9; }
.jw-media-9x16 { width: min(100%, 26rem); aspect-ratio: 9 / 16; }
.jw-media-source, .jw-media-load, .jw-media-player { position: absolute; inset: 0; box-sizing: border-box; width: 100%; height: 100%; }
.jw-media-source, .jw-media-load { display: grid; place-items: center; border: 0; padding: 1rem; background: #111827; color: #fff; text-align: center; text-decoration: none; cursor: pointer; }
.jw-media-source:hover, .jw-media-load:hover { background: #1f2937; }
.jw-media-player { border: 0; background: #000; }
.jw-media-surface { position: absolute; inset: 0; }
.jw-media-original { position: absolute; z-index: 1; top: 8px; right: 8px; max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 9px; border-radius: 5px; background: #111827dd; color: #fff; font-size: 12px; text-decoration: underline; }
.jw-media-error { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px; text-align: center; }
.jw-media-error button { min-height: 44px; padding: 8px 16px; border: 1px solid #64748b; border-radius: 6px; background: #1e293b; color: #fff; cursor: pointer; }
.jw-card { width: min(100%, 42rem); margin: 1rem auto; overflow: hidden; border: 1px solid #d1d5db; border-radius: 0.625rem; background: #fff; color: #111827; }
.jw-card-link { display: grid; color: inherit; text-decoration: none; }
.jw-card-link:hover { background: #f9fafb; }
.jw-card-link > strong { display: block; padding: 1rem 1rem 0.25rem; font-size: 1rem; line-height: 1.4; overflow-wrap: anywhere; }
.jw-card-link > p { margin: 0; padding: 0 1rem 1rem; color: #4b5563; line-height: 1.5; overflow-wrap: anywhere; }
.jw-card-image { display: block; width: 100%; max-height: 18rem; object-fit: cover; }
.jw-card-instagram { border-inline-start: 0.25rem solid #c13584; }
.jw-card-x { border-inline-start: 0.25rem solid #111827; }
.jw-card-tiktok { border-inline-start: 0.25rem solid #25f4ee; }
.jw-card-facebook { border-inline-start: 0.25rem solid #1877f2; }
.jw-card-threads { border-inline-start: 0.25rem solid #000; }
.jw-social-surface { max-width: 550px; margin-inline: auto; }
.jw-social-viewport { position: relative; overflow: auto; max-height: 1400px; width: 100%; }
.jw-social-frame { display: block; border: 0; transform-origin: top left; background: #fff; }
.jw-social-status { margin: 0; padding: 10px 12px; color: #64748b; font-size: 12px; }
.jw-social-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border-top: 1px solid #e2e8f0; }
.jw-social-footer a { color: #2563eb; font-size: 13px; text-decoration: underline; }
.jw-social-footer button { min-height: 44px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; color: #334155; cursor: pointer; }
.jw-social-footer button[hidden] { display: none; }
.jwsoft-social-node { width: min(100%, 42rem); margin: 1rem auto; }
.jwsoft-social-node .jw-card { margin: 0; width: 100%; }
.jwsoft-social-node.ProseMirror-selectednode .jw-card { outline: 2px solid #2563eb; outline-offset: 3px; }
`.trim();

function phpQuote(value) {
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function phpExport(value, indent = 0) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return phpQuote(value);

  const pad = " ".repeat(indent);
  const childPad = " ".repeat(indent + 4);
  const entries = Array.isArray(value)
    ? value.map((item) => `${childPad}${phpExport(item, indent + 4)},`)
    : Object.entries(value).map(
        ([key, item]) =>
          `${childPad}${phpQuote(key)} => ${phpExport(item, indent + 4)},`,
      );

  return entries.length ? `[\n${entries.join("\n")}\n${pad}]` : "[]";
}

const tsSource = await prettier.format(
  `// Generated by scripts/generate-policy.mjs. Do not edit.
export const EDITOR_POLICY_HASH = ${JSON.stringify(policyHash)} as const;
export const EDITOR_POLICY = ${JSON.stringify(policy)} as const;
export const EDITOR_ALLOWED_TAGS = ${JSON.stringify(allowedTags)} as const;
export const EDITOR_ALLOWED_ATTRIBUTES = ${JSON.stringify(allowedAttributes)} as const;
export const EDITOR_CLASS_TOKENS = ${JSON.stringify(classTokens)} as const;
export const EDITOR_DOMPURIFY_CONFIG = ${JSON.stringify(domPurifyConfig)} as const;
export const EDITOR_TOKEN_CSS = ${JSON.stringify(tokenCss)} as const;
`,
  { parser: "typescript" },
);

const phpSource = `<?php

namespace Plugins\\Jwsoft\\TiptapEditor\\Generated;

/** Generated by scripts/generate-policy.mjs. Do not edit. */
final class EditorPolicy
{
    public const SHA256 = ${phpQuote(policyHash)};

    public const POLICY = ${phpExport(policy, 4)};
}
`;

const domPurifySource = await prettier.format(
  `${JSON.stringify(domPurifyConfig)}\n`,
  { parser: "json" },
);

const extensionPath = path.join(root, "resources/extensions/html-content.json");
const extension = JSON.parse(fs.readFileSync(extensionPath, "utf8"));
const htmlContent = extension.components.find(
  ({ name, type }) => name === "HtmlContent" && type === "composite",
);
if (!htmlContent?.props) {
  throw new Error(
    "html-content extension에서 HtmlContent props를 찾을 수 없습니다.",
  );
}
htmlContent.props.purifyConfig = domPurifyConfig;
const extensionSource = await prettier.format(
  `${JSON.stringify(extension)}\n`,
  {
    parser: "json",
  },
);

const outputs = new Map([
  ["resources/js/generated/editorPolicy.ts", tsSource],
  ["resources/generated/dompurify-config.json", domPurifySource],
  ["src/Generated/EditorPolicy.php", phpSource],
  ["resources/extensions/html-content.json", extensionSource],
]);

let stale = false;
for (const [relativePath, contents] of outputs) {
  const outputPath = path.join(root, relativePath);
  if (checkOnly) {
    if (
      !fs.existsSync(outputPath) ||
      fs.readFileSync(outputPath, "utf8") !== contents
    ) {
      console.error(`[jwsoft] policy 파생물이 오래되었습니다: ${relativePath}`);
      stale = true;
    }
    continue;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, contents);
}

if (stale) process.exit(1);
console.log(
  checkOnly
    ? "[jwsoft] Editor policy 파생물 동기화 검사 통과"
    : "[jwsoft] Editor policy 파생물 생성 완료",
);
