import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const stage = path.resolve(process.argv[2] ?? "");
const previousManifestPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : null;
const required = ["composer.json", "composer.lock", "vendor-bundle.zip"];
for (const file of required) {
  if (!fs.existsSync(path.join(stage, file))) {
    throw new Error(`vendor bundle 입력 누락: ${file}`);
  }
}

const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const composerLock = JSON.parse(
  fs.readFileSync(path.join(stage, "composer.lock"), "utf8"),
);
const composerJson = JSON.parse(
  fs.readFileSync(path.join(stage, "composer.json"), "utf8"),
);
const packages = (composerLock.packages ?? []).map((pkg) => ({
  name: pkg.name,
  version: pkg.version,
  reference: pkg.dist?.reference ?? pkg.source?.reference ?? null,
}));
const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? 315532800);
const zipPath = path.join(stage, "vendor-bundle.zip");
const metadata = {
  schema_version: "1.0",
  generator: "jwsoft-tiptap-editor scripts/build-vendor-bundle.mjs",
  target: "plugin:jwsoft-tiptap-editor",
  composer_json_sha256: hash(path.join(stage, "composer.json")),
  composer_lock_sha256: hash(path.join(stage, "composer.lock")),
  zip_sha256: hash(zipPath),
  zip_size: fs.statSync(zipPath).size,
  package_count: packages.length,
  php_requirement: composerJson.require?.php ?? null,
  g7_version: ">=7.0.9",
  packages,
};
let generatedAt = new Date(epoch * 1000).toISOString();
if (previousManifestPath && fs.existsSync(previousManifestPath)) {
  const previous = JSON.parse(fs.readFileSync(previousManifestPath, "utf8"));
  const { generated_at: previousGeneratedAt, ...previousMetadata } = previous;
  if (
    typeof previousGeneratedAt === "string" &&
    !Number.isNaN(Date.parse(previousGeneratedAt)) &&
    JSON.stringify(previousMetadata) === JSON.stringify(metadata)
  ) {
    generatedAt = previousGeneratedAt;
  }
}
const { schema_version: schemaVersion, ...manifestMetadata } = metadata;
const manifest = {
  schema_version: schemaVersion,
  generated_at: generatedAt,
  ...manifestMetadata,
};

fs.writeFileSync(
  path.join(stage, "vendor-bundle.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `[jwsoft] vendor bundle manifest 생성: ${packages.length} packages`,
);
