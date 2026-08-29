import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const [
  remoteCommit,
  previousArtifact,
  githubInstallFile,
  baselineFile,
  uninstalledFile,
  githubActiveFile,
  previousFile,
  updatedFile,
  rollbackFile,
  restoredFile,
] = process.argv.slice(2);
if (
  !remoteCommit ||
  !previousArtifact ||
  !githubInstallFile ||
  !baselineFile ||
  !uninstalledFile ||
  !githubActiveFile ||
  !previousFile ||
  !updatedFile ||
  !rollbackFile ||
  !restoredFile
) {
  throw new Error("GitHub lifecycle evidence 인자가 부족합니다.");
}
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (remoteCommit !== currentCommit) {
  throw new Error("공개 GitHub main과 현재 commit이 다릅니다.");
}
const previous = JSON.parse(
  execFileSync(
    "unzip",
    ["-p", previousArtifact, "jwsoft-tiptap-editor/plugin.json"],
    {
      encoding: "utf8",
    },
  ),
);
if (previous.version === pkg.version) {
  throw new Error("이전 ZIP과 현재 버전이 같습니다.");
}

const githubInstall = read(githubInstallFile);
const baseline = read(baselineFile);
const uninstalled = read(uninstalledFile);
const githubActive = read(githubActiveFile);
const previousState = read(previousFile);
const updated = read(updatedFile);
const rollback = read(rollbackFile);
const restored = read(restoredFile);
if (
  githubInstall.action !== "install-github" ||
  githubInstall.version !== pkg.version ||
  githubInstall.status !== "inactive"
) {
  throw new Error("공개 GitHub 최초 설치 결과가 올바르지 않습니다.");
}
for (const [file, checksum] of Object.entries(
  githubInstall.runtimeHashes ?? {},
)) {
  if (hash(path.join(root, file)) !== checksum) {
    throw new Error(`공개 GitHub runtime checksum 불일치: ${file}`);
  }
}
if (Object.keys(githubInstall.runtimeHashes ?? {}).length < 5) {
  throw new Error("공개 GitHub runtime checksum 증거가 부족합니다.");
}
if (uninstalled.pluginInstalled !== false || baseline.records === undefined) {
  throw new Error("무데이터 삭제 uninstall 증거가 올바르지 않습니다.");
}
if (JSON.stringify(baseline.records) !== JSON.stringify(uninstalled.records)) {
  throw new Error("uninstall 과정에서 콘텐츠 해시가 변경되었습니다.");
}
for (const state of [githubActive, updated, restored]) {
  if (
    state.jwsoft?.version !== pkg.version ||
    state.jwsoft?.status !== "active"
  ) {
    throw new Error("현재 GitHub 버전 활성 상태가 올바르지 않습니다.");
  }
  if (JSON.stringify(state.records) !== JSON.stringify(baseline.records)) {
    throw new Error("GitHub lifecycle 과정에서 콘텐츠 해시가 변경되었습니다.");
  }
}
if (
  previousState.jwsoft?.version !== previous.version ||
  previousState.jwsoft?.status !== "active"
) {
  throw new Error("이전 ZIP 설치 상태가 올바르지 않습니다.");
}
if (
  rollback.jwsoft?.status !== "inactive" ||
  rollback.ckeditor?.status !== "active" ||
  JSON.stringify(rollback.records) !== JSON.stringify(baseline.records)
) {
  throw new Error("CKEditor rollback 상태가 올바르지 않습니다.");
}

const artifact = path.join(
  root,
  `.build/jwsoft-tiptap-editor-${pkg.version}.zip`,
);
const evidence = {
  schemaVersion: 1,
  status: "pass",
  repository: "https://github.com/jiwonpapa/jwsoft-tiptap-editor",
  branch: "main",
  remoteCommit,
  install: {
    source: "github",
    version: pkg.version,
    runtimeHashes: githubInstall.runtimeHashes,
  },
  update: {
    from: previous.version,
    to: pkg.version,
    source: "github",
  },
  uninstall: {
    deleteData: false,
    pluginRecordRemoved: true,
    tablesPreserved: Object.values(uninstalled.tables ?? {}).every(Boolean),
    contentHashesPreserved: true,
  },
  rollback: {
    editor: "sirsoft-ckeditor5",
    contentHashesPreserved: true,
  },
  restored: {
    editor: "jwsoft-tiptap-editor",
    version: pkg.version,
  },
  artifactSha256: fs.existsSync(artifact) ? hash(artifact) : null,
};
const output = path.join(
  root,
  "test-results/parity/github-lifecycle/evidence.json",
);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
  `[jwsoft] public GitHub lifecycle evidence 통과: ${previous.version} -> ${pkg.version}`,
);
