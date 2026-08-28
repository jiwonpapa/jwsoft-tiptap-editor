import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const artifact = path.join(
  root,
  `.build/jwsoft-tiptap-editor-${pkg.version}.zip`,
);
const expectedSha256 = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--expected-sha256="))
  ?.slice("--expected-sha256=".length);
if (!fs.existsSync(artifact))
  throw new Error(`package artifact is missing: ${artifact}`);

const runtimeFiles = [
  "dist/js/plugin.iife.js",
  "resources/extensions/html-editor.json",
  "resources/extensions/html-content.json",
  "plugin.php",
  "plugin.json",
];
const remoteRuntimePatterns = [
  /<script[^>]+src=["']https?:\/\//i,
  /<link[^>]+href=["']https?:\/\//i,
  /(?:import|require)\s*\(?["']https?:\/\//i,
];
const remoteRuntimeHits = [];
for (const file of runtimeFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  if (remoteRuntimePatterns.some((pattern) => pattern.test(content)))
    remoteRuntimeHits.push(file);
}
if (remoteRuntimeHits.length) {
  throw new Error(
    `runtime CDN reference found: ${remoteRuntimeHits.join(", ")}`,
  );
}
const runtimeDependencies = Object.keys(pkg.dependencies ?? {});
if (
  runtimeDependencies.some((name) => name === "react" || name === "react-dom")
) {
  throw new Error("React must not be bundled as a runtime dependency");
}

const listing = execFileSync("unzip", ["-Z1", artifact], { encoding: "utf8" })
  .trim()
  .split("\n");
const requiredEntries = [
  "jwsoft-tiptap-editor/plugin.json",
  "jwsoft-tiptap-editor/config/settings/defaults.json",
  "jwsoft-tiptap-editor/dist/js/plugin.iife.js",
  "jwsoft-tiptap-editor/vendor-bundle.zip",
  "jwsoft-tiptap-editor/vendor-bundle.json",
];
for (const entry of requiredEntries) {
  if (!listing.includes(entry))
    throw new Error(`package entry is missing: ${entry}`);
}
const forbidden = listing.filter((entry) =>
  /(^|\/)(?:\.env(?:\.|$)|node_modules|tests|harness|deploy|vendor)(?:\/|$)|\.test\.[^/]+$/.test(
    entry,
  ),
);
if (forbidden.length)
  throw new Error(`forbidden package paths: ${forbidden.join(", ")}`);

const sha256 = crypto
  .createHash("sha256")
  .update(fs.readFileSync(artifact))
  .digest("hex");
if (expectedSha256 && sha256 !== expectedSha256) {
  throw new Error(
    `reproducible package checksum mismatch: ${sha256} != ${expectedSha256}`,
  );
}
const output = path.join(root, "test-results/parity/supply-chain.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: "pass",
      artifact: path.relative(root, artifact),
      artifactSha256: sha256,
      reproducibleChecksumVerified: Boolean(expectedSha256),
      runtimeCdnReferences: 0,
      runtimeReactDependencies: 0,
      npmLock: "package-lock.json",
      composerLock: "composer.lock",
      requiredEntries,
    },
    null,
    2,
  )}\n`,
);
console.log(`[jwsoft] self-hosted package evidence 통과: ${sha256}`);
