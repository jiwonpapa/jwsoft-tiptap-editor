import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const stage = path.resolve(process.argv[2] ?? "");
if (!stage.startsWith(path.join(root, ".build") + path.sep)) {
  throw new Error("license stage must be inside .build");
}

const npmLock = JSON.parse(
  fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
const composerLock = JSON.parse(
  fs.readFileSync(path.join(root, "composer.lock"), "utf8"),
);
const licenseRoot = path.join(stage, "licenses", "npm");
fs.mkdirSync(licenseRoot, { recursive: true });

const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const packages = [];
for (const [location, metadata] of Object.entries(npmLock.packages)) {
  if (
    !location ||
    !location.startsWith("node_modules/") ||
    metadata.dev === true
  ) {
    continue;
  }
  const name = location.slice("node_modules/".length);
  const sourceDirectory = path.join(root, location);
  const licenseFiles = fs
    .readdirSync(sourceDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /^(?:licen[cs]e|copying|notice)/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
  if (licenseFiles.length === 0) {
    throw new Error(`runtime dependency license file is missing: ${name}`);
  }
  const destinationDirectory = path.join(licenseRoot, ...name.split("/"));
  fs.mkdirSync(destinationDirectory, { recursive: true });
  const files = licenseFiles.map((file) => {
    const source = path.join(sourceDirectory, file);
    const destination = path.join(destinationDirectory, file);
    fs.copyFileSync(source, destination);
    return {
      file: path.relative(stage, destination),
      sha256: sha256(destination),
    };
  });
  packages.push({
    name,
    version: metadata.version,
    license: metadata.license,
    files,
  });
}
packages.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(
  path.join(stage, "licenses", "npm-manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, packages }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(stage, "licenses", "composer-manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      packages: composerLock.packages
        .map(({ name, version, license }) => ({ name, version, license }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
    null,
    2,
  )}\n`,
);
console.log(`[jwsoft] runtime license files copied: npm ${packages.length}개`);
