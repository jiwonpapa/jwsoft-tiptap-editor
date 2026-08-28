import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const resolve = (name) => path.join(root, name);
const hash = (name) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolve(name)))
    .digest("hex");
const fail = (message) => {
  console.error(`[jwsoft] ERROR: ${message}`);
  process.exitCode = 1;
};

const required = [
  "dist/js/plugin.iife.js",
  "vendor-bundle.zip",
  "vendor-bundle.json",
  "composer.json",
  "composer.lock",
];
for (const name of required) {
  if (!fs.existsSync(resolve(name)) || fs.statSync(resolve(name)).size === 0) {
    fail(`GitHub 설치 원본 누락: ${name}`);
  }
}

if (process.exitCode) process.exit();

const manifest = JSON.parse(
  fs.readFileSync(resolve("vendor-bundle.json"), "utf8"),
);
const lock = JSON.parse(fs.readFileSync(resolve("composer.lock"), "utf8"));
const packages = (lock.packages ?? []).map((pkg) => ({
  name: pkg.name,
  version: pkg.version,
  reference: pkg.dist?.reference ?? pkg.source?.reference ?? null,
}));

if (manifest.composer_json_sha256 !== hash("composer.json"))
  fail("GitHub vendor bundle의 composer.json checksum이 다릅니다.");
if (manifest.composer_lock_sha256 !== hash("composer.lock"))
  fail("GitHub vendor bundle의 composer.lock checksum이 다릅니다.");
if (manifest.zip_sha256 !== hash("vendor-bundle.zip"))
  fail("GitHub vendor bundle ZIP checksum이 다릅니다.");
if (manifest.zip_size !== fs.statSync(resolve("vendor-bundle.zip")).size)
  fail("GitHub vendor bundle ZIP 크기가 다릅니다.");
if (JSON.stringify(manifest.packages) !== JSON.stringify(packages))
  fail("GitHub vendor bundle 패키지 목록이 composer.lock과 다릅니다.");

try {
  execFileSync("unzip", ["-tqq", resolve("vendor-bundle.zip")], {
    stdio: "ignore",
  });
} catch {
  fail("GitHub vendor bundle ZIP 무결성 검사가 실패했습니다.");
}

if (!process.exitCode) {
  console.log(
    `[jwsoft] GitHub 설치 원본 검사 통과: JS ${fs.statSync(resolve("dist/js/plugin.iife.js")).size} bytes, Composer ${packages.length} packages`,
  );
}
