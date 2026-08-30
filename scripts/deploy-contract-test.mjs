import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const deploy = fs.readFileSync(path.join(root, "scripts/deploy.sh"), "utf8");
const remotePreflight = fs.readFileSync(
  path.join(root, "scripts/remote-deploy-preflight.sh"),
  "utf8",
);

const requireText = (text, description) => {
  if (!deploy.includes(text))
    throw new Error(`deploy contract 누락: ${description}`);
};

requireText(
  'PRODUCTION_APPROVAL:-}" = "jwsoft-tiptap-editor-production"',
  "production confirmation token",
);
requireText("APPROVED_STAGING_SHA256", "approved staging checksum");
requireText("EXPECTED_APP_ENV", "explicit remote application environment");
requireText(
  'sudo -n -u "$DEPLOY_RUN_USER" -- bash -s --',
  "explicit application owner execution",
);
requireText('"${remote_shell[@]}"', "remote execution account routing");
requireText('[ "$action" = "--apply" ]', "explicit apply gate");
requireText("remote-deploy-preflight.sh", "read-only remote preflight");
requireText(
  'deploy-evidence.mjs" verify-production',
  "production staging evidence verification",
);
requireText('deploy-evidence.mjs" record', "deploy smoke evidence record");

const smokeIndex = deploy.indexOf(
  'curl --fail --silent --show-error --location --max-time 20 "$SMOKE_URL"',
);
const recordIndex = deploy.indexOf('deploy-evidence.mjs" record');
if (smokeIndex === -1 || recordIndex === -1 || smokeIndex > recordIndex) {
  throw new Error("deploy evidence는 smoke 통과 후에만 기록해야 합니다");
}

const remoteStart = deploy.indexOf("<<'REMOTE'");
const remoteEnd = deploy.indexOf("\nREMOTE", remoteStart);
if (remoteStart === -1 || remoteEnd === -1) {
  throw new Error("deploy remote transaction을 찾을 수 없습니다");
}
const remote = deploy.slice(remoteStart, remoteEnd);
const rollbackStart = remote.indexOf("rollback() {");
const checksumCheck = remote.indexOf(
  '[ "$actual_checksum" = "$expected_checksum" ]',
);
const rollbackTrap = remote.indexOf("trap rollback ERR");
if (
  checksumCheck === -1 ||
  rollbackTrap === -1 ||
  checksumCheck > rollbackTrap
) {
  throw new Error(
    "원격 checksum 검증은 rollback trap 무장 전에 실행해야 합니다",
  );
}
const deactivateCk = remote.indexOf(
  "plugin:deactivate sirsoft-ckeditor5 --no-interaction",
);
const transitionNotice = remote.indexOf("에디터 전환: CKEditor");
const activateJw = remote.indexOf(
  "plugin:activate jwsoft-tiptap-editor --no-interaction",
);
if (
  transitionNotice === -1 ||
  remote.includes("legacyContentRiskAcknowledged") ||
  deactivateCk === -1 ||
  activateJw === -1 ||
  transitionNotice > deactivateCk ||
  deactivateCk > activateJw
) {
  throw new Error("배포는 CKEditor5 비활성화 후 JWSoft 활성화 순서여야 합니다");
}

const rollbackEnd = remote.indexOf("\n}\n", rollbackStart);
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

for (const required of [
  "배포 대상 APP_ENV 불일치",
  "production은 APP_ENV=production",
  "production은 APP_DEBUG=false",
  "storage/framework/cache/data",
  "storage/framework/views",
  "storage/logs",
  "bootstrap/cache",
  "plugins",
  "DEPLOY_MODE=update",
  "DEPLOY_MODE=install",
  "pending 경로가 있어 덮어쓰지",
]) {
  if (!remotePreflight.includes(required)) {
    throw new Error(`remote deploy preflight 누락: ${required}`);
  }
}

const preflightCall = deploy.indexOf('remote-deploy-preflight.sh"');
const remoteMkdir = deploy.indexOf('ssh "$DEPLOY_HOST" "mkdir -p');
if (preflightCall === -1 || remoteMkdir === -1 || preflightCall > remoteMkdir) {
  throw new Error(
    "원격 preflight는 artifact 디렉터리 생성 전에 실행해야 합니다",
  );
}

console.log("[jwsoft] deploy contract 통과");
