import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const bundlePath = path.join(root, "dist/js/plugin.iife.js");
const browserPath = path.join(
  root,
  "test-results/parity/browser/evidence.json",
);
if (!fs.existsSync(bundlePath)) throw new Error("dist bundle is missing");
if (!fs.existsSync(browserPath)) throw new Error("browser evidence is missing");

const browser = JSON.parse(fs.readFileSync(browserPath, "utf8"));
const readyMs = browser.performance?.readyMs ?? [];
const instances = browser.performance?.instances ?? [];
if (readyMs.length < 5 || instances.length < 5) {
  throw new Error(
    "at least five browser performance observations are required",
  );
}
const percentile = (values, quantile) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
  ];
};
const gzipBytes = zlib.gzipSync(fs.readFileSync(bundlePath), {
  level: 9,
}).byteLength;
const budgets = {
  bundleGzipBytes: 500 * 1024,
  routeToEditorP95Ms: 2_500,
  maxConcurrentInstances: 1,
};
const observed = {
  bundleGzipBytes: gzipBytes,
  routeToEditorP95Ms: percentile(readyMs, 0.95),
  maxConcurrentInstances: Math.max(...instances),
};
const failures = Object.entries(budgets)
  .filter(([key, limit]) => observed[key] > limit)
  .map(([key, limit]) => `${key}: ${observed[key]} > ${limit}`);
if (failures.length)
  throw new Error(`performance budget failed: ${failures.join(", ")}`);

const output = path.join(root, "test-results/parity/performance.json");
fs.writeFileSync(
  output,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: "pass",
      metricScope:
        "authenticated G7 route navigation until one editor instance is ready",
      sampleCount: readyMs.length,
      budgets,
      observed,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `[jwsoft] performance budget 통과: gzip ${gzipBytes} bytes, route p95 ${observed.routeToEditorP95Ms} ms`,
);
