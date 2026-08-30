import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  partitionReleaseRows,
  validateProductionVersion,
} from "./release-phases.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { items } = JSON.parse(
  fs.readFileSync(
    path.join(root, "harness/contracts/stable-readiness.json"),
    "utf8",
  ),
);
assert.equal(items.length, 62);
for (const [phase, count] of Object.entries({
  candidate: 57,
  predeploy: 60,
  production: 61,
  final: 62,
})) {
  const { required, deferred } = partitionReleaseRows(items, phase);
  assert.equal(required.length, count);
  assert.equal(required.length + deferred.length, 62);
  assert.equal(
    new Set([...required, ...deferred].map(({ id }) => id)).size,
    62,
  );
  assert.ok(required.some(({ id }) => id === "surfaces.public-board"));
  assert.ok(required.some(({ id }) => id === "security.server-endpoints"));
}
assert.throws(
  () => partitionReleaseRows(items, "skip-browser"),
  /unknown release phase/,
);
assert.throws(
  () => partitionReleaseRows([], "predeploy"),
  /missing phase requirement/,
);
for (const version of ["0.1.0", "0.1.0-rc.1"])
  validateProductionVersion(version);
for (const version of [
  "0.1.0-alpha.21",
  "0.1.0-beta.1",
  "",
  "0.1.0-rc.1-extra",
])
  assert.throws(
    () => validateProductionVersion(version),
    /production requires/,
  );
const deploy = fs.readFileSync(path.join(root, "scripts/deploy.sh"), "utf8");
const apply = deploy.indexOf('[ "$action" = "--apply" ]');
const gate = deploy.indexOf('scripts/deployment-gate.mjs"');
const remote = deploy.indexOf('ssh "$DEPLOY_HOST"');
assert.ok(
  apply < gate && gate < remote,
  "current evidence must be checked after explicit apply and before any remote action",
);
console.log(
  "[jwsoft] release phases 57/60/61/62 and fail-closed deployment tests passed",
);
