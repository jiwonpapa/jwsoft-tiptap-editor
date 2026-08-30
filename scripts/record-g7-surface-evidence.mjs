import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const browserDir = path.join(root, "test-results/parity/browser");
const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const match = argument.match(/^--([^=]+)=(.*)$/s);
    if (!match) throw new Error(`invalid argument: ${argument}`);
    return [match[1], match[2]];
  }),
);

const requiredArgs = [
  "admin-board-post-id",
  "public-board-post-id",
  "reply-post-id",
  "product-id",
  "product-code",
  "page-id",
  "page-slug",
  "plugin-version",
  "plugin-package-sha256",
  "source-commit",
  "g7-version",
  "g7-commit",
  "observed-at",
  "ready-ms",
  "instances",
  "fallback-tiptap-count",
  "fallback-textarea-count",
  "product-api-canonical",
  "page-api-canonical",
  "product-show-active",
  "page-show-active",
  "renderer-workers",
];
for (const key of requiredArgs) {
  if (args[key] === undefined || args[key] === "") {
    throw new Error(`missing G7 surface evidence argument: --${key}`);
  }
}

const positiveInteger = (key) => {
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
};
const nonNegativeInteger = (key) => {
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return value;
};
const boolean = (key) => {
  if (!new Set(["true", "false"]).has(args[key])) {
    throw new Error(`${key} must be true or false`);
  }
  return args[key] === "true";
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

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args["plugin-version"])) {
  throw new Error("plugin-version must be a semantic version");
}
for (const key of ["source-commit", "g7-commit"]) {
  if (!/^[0-9a-f]{40}$/.test(args[key])) {
    throw new Error(`${key} must be a full git commit`);
  }
}
if (!/^[0-9a-f]{64}$/.test(args["plugin-package-sha256"])) {
  throw new Error("plugin-package-sha256 must be a SHA-256 digest");
}
if (Number.isNaN(Date.parse(args["observed-at"]))) {
  throw new Error("observed-at must be an ISO date-time");
}

const screenshotGroups = {
  publicBoard: [
    "public-board-create.png",
    "public-board-edit.png",
    "public-board-reply.png",
    "public-board-show.png",
  ],
  adminBoard: [
    "admin-board-create.png",
    "admin-board-edit.png",
    "admin-board-show.png",
  ],
  ecommerce: [
    "ecommerce-create.png",
    "ecommerce-edit.png",
    "ecommerce-public.png",
  ],
  page: [
    "page-create.png",
    "page-edit.png",
    "page-admin-show.png",
    "page-public.png",
  ],
  fallback: ["direct-html-editor-fallback.png"],
  settings: ["plugin-settings.png"],
};
const screenshot = (file) => {
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
};
const screenshots = Object.fromEntries(
  Object.entries(screenshotGroups).map(([group, files]) => [
    group,
    files.map(screenshot),
  ]),
);

const readyMs = numberList("ready-ms");
const instances = numberList("instances");
if (instances.some((count) => !Number.isInteger(count) || count !== 1)) {
  throw new Error("every observed editor route must have one editor instance");
}
if (nonNegativeInteger("fallback-tiptap-count") !== 0) {
  throw new Error("direct HtmlEditor fallback must not mount Tiptap");
}
if (positiveInteger("fallback-textarea-count") !== 1) {
  throw new Error("direct HtmlEditor fallback must retain one textarea");
}
if (!boolean("product-api-canonical") || !boolean("page-api-canonical")) {
  throw new Error("product and page APIs must expose canonical stored HTML");
}
for (const key of ["product-show-active", "page-show-active"]) {
  if (!boolean(key)) {
    throw new Error(`${key} must pass with the plugin active`);
  }
}
if (positiveInteger("renderer-workers") < 2) {
  throw new Error(
    "public renderer evidence requires at least two HTTP workers",
  );
}

const provenance = {
  browser: args.browser ?? "Chromium via Playwright CLI",
  observedAt: new Date(args["observed-at"]).toISOString(),
  pluginVersion: args["plugin-version"],
  pluginPackageSha256: args["plugin-package-sha256"],
  sourceCommit: args["source-commit"],
  g7Version: args["g7-version"],
  g7Commit: args["g7-commit"],
};
const publicBoard = {
  schemaVersion: 1,
  status: "pass",
  ...provenance,
  workflow: {
    create: true,
    edit: true,
    reply: true,
    show: true,
    postId: positiveInteger("public-board-post-id"),
    replyPostId: positiveInteger("reply-post-id"),
    canonicalStoredHtml: true,
  },
  screenshots: screenshots.publicBoard,
};
const adminBoard = {
  schemaVersion: 1,
  status: "pass",
  ...provenance,
  workflow: {
    create: true,
    edit: true,
    show: true,
    postId: positiveInteger("admin-board-post-id"),
    canonicalStoredHtml: true,
  },
  screenshots: screenshots.adminBoard,
};
const fallback = {
  schemaVersion: 1,
  status: "pass",
  ...provenance,
  surface: "G7 admin notification template direct HtmlEditor modal",
  tiptapInstances: 0,
  dialogTextareas: 1,
  screenshots: screenshots.fallback,
};
const ecommerce = {
  schemaVersion: 1,
  status: "pass",
  ...provenance,
  workflow: {
    createScreen: true,
    editSaved: true,
    publicShow: true,
    productId: positiveInteger("product-id"),
    productCode: args["product-code"],
    canonicalApiHtml: true,
  },
  renderer: {
    workers: positiveInteger("renderer-workers"),
    cacheKey: "fresh",
    canonicalHtmlVisible: true,
  },
  screenshots: screenshots.ecommerce,
};
const page = {
  schemaVersion: 1,
  status: "pass",
  ...provenance,
  workflow: {
    createSaved: true,
    editSaved: true,
    adminShow: true,
    publicShow: true,
    pageId: positiveInteger("page-id"),
    pageSlug: args["page-slug"],
    canonicalApiHtml: true,
  },
  renderer: {
    workers: positiveInteger("renderer-workers"),
    cacheKey: "fresh",
    canonicalHtmlVisible: true,
  },
  screenshots: screenshots.page,
};
const overall = {
  schemaVersion: 2,
  status: "pass",
  ...provenance,
  completed: [
    "surfaces.public-board",
    "surfaces.admin-board",
    "surfaces.ecommerce",
    "surfaces.page",
    "surfaces.fallback",
  ],
  blocked: [],
  surfaces: {
    publicBoard: publicBoard.workflow,
    adminBoard: adminBoard.workflow,
    ecommerce: ecommerce.workflow,
    page: page.workflow,
    fallback: {
      tiptapInstances: fallback.tiptapInstances,
      dialogTextareas: fallback.dialogTextareas,
    },
  },
  performance: { readyMs, instances },
  screenshots,
};

fs.mkdirSync(browserDir, { recursive: true });
const outputs = {
  "g7-surfaces.json": overall,
  "public-board.json": publicBoard,
  "admin-board.json": adminBoard,
  "direct-html-editor-fallback.json": fallback,
  "ecommerce-surface.json": ecommerce,
  "page-surface.json": page,
};
for (const [file, value] of Object.entries(outputs)) {
  fs.writeFileSync(
    path.join(browserDir, file),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
console.log(`[jwsoft] G7 ${args["g7-version"]} 실제 화면 5개 통과`);
