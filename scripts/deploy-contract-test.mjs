import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const deploy = fs.readFileSync(path.join(root, "scripts/deploy.sh"), "utf8");

const requireText = (text, description) => {
  if (!deploy.includes(text))
    throw new Error(`deploy contract 누락: ${description}`);
};

requireText(
  'PRODUCTION_APPROVAL:-}" = "jwsoft-tiptap-editor-production"',
  "production confirmation token",
);
requireText("APPROVED_STAGING_SHA256", "approved staging checksum");
requireText('[ "$action" = "--apply" ]', "explicit apply gate");

const remoteStart = deploy.indexOf("<<'REMOTE'");
const remoteEnd = deploy.indexOf("\nREMOTE", remoteStart);
if (remoteStart === -1 || remoteEnd === -1) {
  throw new Error("deploy remote transaction을 찾을 수 없습니다");
}
const remote = deploy.slice(remoteStart, remoteEnd);
const deactivateCk = remote.indexOf(
  "plugin:deactivate sirsoft-ckeditor5 --no-interaction",
);
const verifyLegacyRisk = remote.indexOf("legacyContentRiskAcknowledged");
const activateJw = remote.indexOf(
  "plugin:activate jwsoft-tiptap-editor --no-interaction",
);
if (
  verifyLegacyRisk === -1 ||
  deactivateCk === -1 ||
  activateJw === -1 ||
  verifyLegacyRisk > deactivateCk ||
  deactivateCk > activateJw
) {
  throw new Error("배포는 CKEditor5 비활성화 후 JWSoft 활성화 순서여야 합니다");
}

const rollbackStart = remote.indexOf("rollback() {");
const rollbackEnd = remote.indexOf("}\ntrap rollback ERR", rollbackStart);
if (rollbackStart === -1 || rollbackEnd === -1) {
  throw new Error("배포 rollback transaction을 찾을 수 없습니다");
}
const rollback = remote.slice(rollbackStart, rollbackEnd);
const rollbackDeactivateJw = rollback.indexOf(
  "plugin:deactivate jwsoft-tiptap-editor",
);
const rollbackActivateCk = rollback.indexOf(
  "plugin:activate sirsoft-ckeditor5",
);
if (
  rollbackDeactivateJw === -1 ||
  rollbackActivateCk === -1 ||
  rollbackDeactivateJw > rollbackActivateCk
) {
  throw new Error("롤백은 JWSoft 비활성화 후 CKEditor5 활성화 순서여야 합니다");
}

console.log("[jwsoft] deploy contract 통과");
