import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const npm = readJson("package.json");
const plugin = readJson("plugin.json");
const composer = readJson("composer.json");
const npmLock = readJson("package-lock.json");
const composerLock = readJson("composer.lock");
const notices = fs.readFileSync(
  path.join(root, "THIRD_PARTY_NOTICES.md"),
  "utf8",
);

if (npm.private !== true || npm.license !== "UNLICENSED") {
  throw new Error("npm package must remain private and UNLICENSED");
}
if (plugin.license !== "Proprietary" || composer.license !== "proprietary") {
  throw new Error("product license metadata must be Proprietary");
}
if (!fs.existsSync(path.join(root, "LICENSE"))) {
  throw new Error("product LICENSE is missing");
}

const runtimeNpm = Object.entries(npmLock.packages)
  .filter(
    ([location, metadata]) =>
      Boolean(location) &&
      location.startsWith("node_modules/") &&
      metadata.dev !== true,
  )
  .map(([location, metadata]) => ({
    name: location.slice("node_modules/".length),
    version: metadata.version,
    license: metadata.license,
  }));
const allowedNpmLicenses = new Set([
  "MIT",
  "Apache-2.0",
  "(MPL-2.0 OR Apache-2.0)",
]);
for (const dependency of runtimeNpm) {
  if (!allowedNpmLicenses.has(dependency.license)) {
    throw new Error(
      `unapproved npm runtime license: ${dependency.name} (${dependency.license})`,
    );
  }
  if (!notices.includes(`\`${dependency.name}@${dependency.version}\``)) {
    throw new Error(
      `npm dependency is absent from notices: ${dependency.name}`,
    );
  }
  if (dependency.name.startsWith("@tiptap-pro/")) {
    throw new Error(
      `Tiptap Pro dependency is not approved: ${dependency.name}`,
    );
  }
}
for (const dependency of composerLock.packages) {
  const licenses = Array.isArray(dependency.license)
    ? dependency.license
    : [dependency.license];
  if (licenses.some((license) => license !== "MIT")) {
    throw new Error(
      `unapproved Composer runtime license: ${dependency.name} (${licenses.join(" OR ")})`,
    );
  }
  if (!notices.includes(`\`${dependency.name}@${dependency.version}\``)) {
    throw new Error(
      `Composer dependency is absent from notices: ${dependency.name}`,
    );
  }
}

const artifact = path.join(
  root,
  `.build/jwsoft-tiptap-editor-${npm.version}.zip`,
);
let artifactChecked = false;
if (process.argv.includes("--artifact")) {
  if (!fs.existsSync(artifact)) throw new Error("release artifact is missing");
  const listing = execFileSync("unzip", ["-Z1", artifact], {
    encoding: "utf8",
  }).split("\n");
  const required = [
    "jwsoft-tiptap-editor/LICENSE",
    "jwsoft-tiptap-editor/THIRD_PARTY_NOTICES.md",
    "jwsoft-tiptap-editor/licenses/npm-manifest.json",
    "jwsoft-tiptap-editor/licenses/composer-manifest.json",
    "jwsoft-tiptap-editor/licenses/npm/dompurify/LICENSE",
  ];
  for (const entry of required) {
    if (!listing.includes(entry)) {
      throw new Error(`artifact license entry is missing: ${entry}`);
    }
  }
  artifactChecked = true;
}

const evidence = {
  schemaVersion: 1,
  status: "pass",
  productLicense: "Proprietary",
  npmRuntimePackages: runtimeNpm.length,
  composerRuntimePackages: composerLock.packages.length,
  tiptapProPackages: 0,
  domPurifyLicenseOption: "Apache-2.0",
  artifactChecked,
};
fs.mkdirSync(path.join(root, "test-results", "release"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(root, "test-results", "release", "license.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  `[jwsoft] license audit 통과: npm ${runtimeNpm.length}개, composer ${composerLock.packages.length}개`,
);
