const deploymentIds = ["deploy.staging", "deploy.production-checksum"];
const onlineIds = [
  "lifecycle.install-sources",
  "lifecycle.github-update",
  "lifecycle.uninstall",
];
const deferredByPhase = {
  candidate: [...deploymentIds, ...onlineIds],
  predeploy: deploymentIds,
  production: ["deploy.production-checksum"],
  final: [],
};

export function partitionReleaseRows(rows, phase) {
  if (!Object.hasOwn(deferredByPhase, phase))
    throw new Error(`unknown release phase: ${phase}`);
  const deferredIds = new Set(deferredByPhase[phase]);
  for (const id of deferredIds) {
    if (!rows.some((row) => row.id === id))
      throw new Error(`missing phase requirement: ${id}`);
  }
  return {
    required: rows.filter((row) => !deferredIds.has(row.id)),
    deferred: rows.filter((row) => deferredIds.has(row.id)),
  };
}

export function validateProductionVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/.test(version)) {
    throw new Error(
      "production requires a final or release-candidate version, never alpha/beta",
    );
  }
}
