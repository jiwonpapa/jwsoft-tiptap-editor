import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const readArtifact = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute))
    throw new Error(`parity artifact is missing: ${relative}`);
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (parsed.status !== "pass")
    throw new Error(`parity artifact did not pass: ${relative}`);
  return parsed;
};
const artifacts = {
  browser: "test-results/parity/browser/evidence.json",
  corpus: "test-results/parity/corpus.json",
  integration: "test-results/parity/integration.json",
  lifecycle: "test-results/parity/lifecycle/evidence.json",
  performance: "test-results/parity/performance.json",
  supplyChain: "test-results/parity/supply-chain.json",
};
const data = Object.fromEntries(
  Object.entries(artifacts).map(([key, file]) => [key, readArtifact(file)]),
);
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
if (data.browser.locales?.join(",") !== "ko,en") {
  throw new Error("Korean/English browser evidence is incomplete");
}
if (
  !data.browser.pluginVersion ||
  !/^[0-9a-f]{40}$/.test(data.browser.sourceCommit ?? "") ||
  Number.isNaN(Date.parse(data.browser.observedAt ?? ""))
) {
  throw new Error("browser evidence provenance is incomplete");
}
for (const surface of ["board", "ecommerce", "page"]) {
  const value = data.browser.surfaces?.[surface];
  if (!value?.create || !value?.reedit || !value?.recordId) {
    throw new Error(`${surface} create/re-edit browser evidence is incomplete`);
  }
}
if (
  !data.lifecycle.install?.tablePresent ||
  !data.lifecycle.rollback?.contentHashesPreserved
) {
  throw new Error("install/rollback lifecycle evidence is incomplete");
}
if (
  data.lifecycle.update?.to !== pkg.version ||
  data.lifecycle.restored?.version !== pkg.version
) {
  throw new Error("lifecycle evidence plugin version is stale");
}
if (data.lifecycle.update?.artifactSha256 !== data.supplyChain.artifactSha256) {
  throw new Error("lifecycle and supply-chain artifact checksums differ");
}
if (data.corpus.securityCases?.some(({ status }) => status !== "pass")) {
  throw new Error("security corpus contains failures");
}
if (data.corpus.legacyCases?.some(({ status }) => status !== "pass")) {
  throw new Error("legacy corpus contains failures");
}

const contract = JSON.parse(
  fs.readFileSync(
    path.join(root, "harness/contracts/ckeditor-parity.json"),
    "utf8",
  ),
);
const artifactFor = (id) => {
  if (id.startsWith("lifecycle.")) return [artifacts.lifecycle];
  if (
    id === "editor.create" ||
    id === "editor.reedit" ||
    id === "editor.keyboard-a11y" ||
    id.startsWith("i18n.") ||
    id.startsWith("surfaces.")
  ) {
    return [artifacts.browser];
  }
  if (id === "editor.legacy-html") return [artifacts.corpus];
  if (id.startsWith("security.") || id.startsWith("policy.")) {
    return [artifacts.corpus, artifacts.integration];
  }
  if (id.startsWith("performance."))
    return [artifacts.performance, artifacts.browser];
  if (id.startsWith("supply-chain.")) return [artifacts.supplyChain];
  if (
    id.startsWith("image.") ||
    id.startsWith("permissions.") ||
    id.startsWith("hooks.")
  ) {
    return [artifacts.integration, artifacts.lifecycle];
  }
  throw new Error(`no evidence mapping for contract item: ${id}`);
};
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (dirty)
  throw new Error(
    "parity evidence must be generated from a clean committed tree",
  );
const evidence = {
  schemaVersion: 1,
  status: "pass",
  generatedAt: new Date().toISOString(),
  source: contract.source,
  g7Version: data.integration.g7Version,
  pluginVersion: pkg.version,
  commit,
  artifactSha256: data.supplyChain.artifactSha256,
  evidenceBoundaries: {
    browser: {
      pluginVersion: data.browser.pluginVersion,
      sourceCommit: data.browser.sourceCommit,
      observedAt: data.browser.observedAt,
    },
    packageLifecycle: {
      pluginVersion: pkg.version,
      sourceCommit: commit,
    },
  },
  environment: {
    platform: `${os.platform()}-${os.arch()}`,
    node: process.version,
    browser: data.browser.browser,
  },
  results: contract.items.map(({ id, gate, requirement }) => ({
    id,
    gate,
    requirement,
    status: "pass",
    artifacts: artifactFor(id),
  })),
};
const output = path.join(root, "test-results/parity/evidence.json");
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
  `[jwsoft] parity evidence ${evidence.results.length}개 생성: ${commit.slice(0, 12)}`,
);
