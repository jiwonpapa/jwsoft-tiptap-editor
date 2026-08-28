import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { format } from "prettier";

const root = path.resolve(import.meta.dirname, "..");
const npmLock = JSON.parse(
  fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
const composerLock = JSON.parse(
  fs.readFileSync(path.join(root, "composer.lock"), "utf8"),
);

const npmPackages = Object.entries(npmLock.packages)
  .filter(
    ([location, metadata]) =>
      Boolean(location) &&
      location.startsWith("node_modules/") &&
      metadata.dev !== true,
  )
  .map(([location, metadata]) => ({
    name: location.slice("node_modules/".length),
    version: metadata.version,
    license: metadata.license ?? "NOASSERTION",
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const composerPackages = composerLock.packages
  .map((metadata) => ({
    name: metadata.name,
    version: metadata.version,
    license: Array.isArray(metadata.license)
      ? metadata.license.join(" OR ")
      : (metadata.license ?? "NOASSERTION"),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const table = (packages) =>
  packages
    .map(
      ({ name, version, license }) =>
        `| \`${name}@${version}\` | \`${license}\` |`,
    )
    .join("\n");

const source = `# Third-Party Notices

This product is proprietary software. The components below retain their own licenses; inclusion does not change the product license.

Release ZIP files preserve the exact JavaScript license texts under \`licenses/npm/\`. PHP dependency license files remain inside \`vendor-bundle.zip\`, with package manifests at \`licenses/npm-manifest.json\` and \`licenses/composer-manifest.json\`.

DOMPurify declares \`MPL-2.0 OR Apache-2.0\`; this distribution uses the Apache-2.0 option and includes both upstream license files for traceability. No Tiptap Pro package is included.

## JavaScript runtime dependencies

| Package | License |
| --- | --- |
${table(npmPackages)}

## PHP runtime dependencies

| Package | License |
| --- | --- |
${table(composerPackages)}

## Principal attribution

- Tiptap packages: Copyright (c) 2025 Tiptap GmbH, MIT License.
- ProseMirror, orderedmap, rope-sequence, and w3c-keyname: Copyright Marijn Haverbeke and contributors, MIT License.
- DOMPurify: Dr.-Ing. Mario Heiderich and Cure53, Apache-2.0 option selected.
- linkifyjs: Copyright (c) 2024 Nick Frasser, MIT License.
- Symfony packages: Fabien Potencier and Symfony contributors, MIT License.
- PHP-FIG packages, League URI, and Masterminds HTML5 retain the copyright notices shipped in \`vendor-bundle.zip\`.

This file is generated from \`package-lock.json\` and \`composer.lock\`. Run \`npm run generate:notices\` after dependency changes.
`;
const output = await format(source, { parser: "markdown" });

const target = path.join(root, "THIRD_PARTY_NOTICES.md");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== output) {
    console.error(
      "[jwsoft] ERROR: THIRD_PARTY_NOTICES.md가 lockfile과 동기화되지 않았습니다.",
    );
    process.exit(1);
  }
  console.log("[jwsoft] third-party notices 동기화 검사 통과");
} else {
  fs.writeFileSync(target, output);
  console.log(
    `[jwsoft] third-party notices 생성: npm ${npmPackages.length}개, composer ${composerPackages.length}개`,
  );
}
