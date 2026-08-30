import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hashFile, sourceFingerprint } from "./evidence-provenance.mjs";
import { currentPackage } from "./stable-evidence.mjs";
import { validateProductionVersion } from "./release-phases.mjs";

const root = path.resolve(import.meta.dirname, "..");
const [environment, artifact] = process.argv.slice(2);
if (!["staging", "production"].includes(environment) || !artifact)
  throw new Error("usage: deployment-gate.mjs staging|production ARTIFACT");
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).version;
if (environment === "production") validateProductionVersion(version);
const checksum = currentPackage({
  root,
  version,
  fingerprint: sourceFingerprint(root),
  runtimeSha256: hashFile(path.join(root, "dist/js/plugin.iife.js")),
});
if (hashFile(path.resolve(artifact)) !== checksum)
  throw new Error(
    "deployment artifact differs from the tested reproducible ZIP",
  );
execFileSync(
  process.execPath,
  [
    path.join(root, "scripts/stable-readiness-gate.mjs"),
    `--phase=${environment === "production" ? "production" : "predeploy"}`,
  ],
  { cwd: root, stdio: "inherit" },
);
console.log(
  `[jwsoft] deployment authorized by current evidence: ${environment} ${version} ${checksum}`,
);
