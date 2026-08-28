import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const browserDir = path.join(root, "test-results/parity/browser");
const requiredScreenshots = [
  "board-create.png",
  "board-reedit.png",
  "ecommerce-create.png",
  "ecommerce-reedit.png",
  "ecommerce-en.png",
  "ecommerce-ko.png",
  "page-reedit.png",
];
const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const match = argument.match(/^--([^=]+)=(.*)$/s);
    if (!match) throw new Error(`invalid argument: ${argument}`);
    return [match[1], match[2]];
  }),
);
const requiredArgs = [
  "board-post-id",
  "product-id",
  "page-id",
  "ready-ms",
  "instances",
  "editor-label",
  "toolbar-label",
  "tabbable",
  "plugin-version",
  "source-commit",
  "observed-at",
];
for (const key of requiredArgs) {
  if (!args[key])
    throw new Error(`missing browser evidence argument: --${key}`);
}

const positiveInteger = (key) => {
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${key} must be a positive integer`);
  return value;
};
const numberList = (key) => {
  const values = args[key].split(",").map(Number);
  if (
    values.length < 5 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error(`${key} must contain at least five non-negative numbers`);
  }
  return values;
};
const screenshots = requiredScreenshots.map((file) => {
  const absolute = path.join(browserDir, file);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size < 1_000) {
    throw new Error(`missing or empty browser screenshot: ${file}`);
  }
  return {
    file: `test-results/parity/browser/${file}`,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(absolute))
      .digest("hex"),
  };
});
const readyMs = numberList("ready-ms");
const instances = numberList("instances");
if (instances.some((count) => !Number.isInteger(count) || count !== 1)) {
  throw new Error("every observed route must have exactly one editor instance");
}
if (args["editor-label"] !== "JWSoft Tiptap editor") {
  throw new Error("editor accessible label mismatch");
}
if (args["toolbar-label"] !== "standard editor tools") {
  throw new Error("English toolbar accessible label mismatch");
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args["plugin-version"])) {
  throw new Error("plugin-version must be a semantic version");
}
if (!/^[0-9a-f]{40}$/.test(args["source-commit"])) {
  throw new Error("source-commit must be a full git commit");
}
if (Number.isNaN(Date.parse(args["observed-at"]))) {
  throw new Error("observed-at must be an ISO date-time");
}

const evidence = {
  schemaVersion: 1,
  status: "pass",
  browser: args.browser ?? "Chromium via Playwright CLI",
  observedAt: new Date(args["observed-at"]).toISOString(),
  pluginVersion: args["plugin-version"],
  sourceCommit: args["source-commit"],
  surfaces: {
    board: {
      create: true,
      reedit: true,
      recordId: positiveInteger("board-post-id"),
    },
    ecommerce: {
      create: true,
      reedit: true,
      recordId: positiveInteger("product-id"),
    },
    page: { create: true, reedit: true, recordId: positiveInteger("page-id") },
  },
  accessibility: {
    editorRole: "textbox",
    editorLabel: args["editor-label"],
    toolbarLabel: args["toolbar-label"],
    tabbableToolbarButtons: positiveInteger("tabbable"),
  },
  locales: ["ko", "en"],
  performance: { readyMs, instances },
  screenshots,
};
fs.mkdirSync(browserDir, { recursive: true });
fs.writeFileSync(
  path.join(browserDir, "evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  `[jwsoft] 실제 G7 ${args["plugin-version"]} 화면 ${screenshots.length}개 browser evidence 기록`,
);
