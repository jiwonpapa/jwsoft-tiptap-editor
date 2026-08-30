#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

environment="${1:-}"
action="${2:---plan}"
[ -n "$environment" ] || fail "환경 이름이 필요합니다. 예: staging"
require_safe_token "환경" "$environment"
case "$environment" in staging|production) ;; *) fail "환경은 staging 또는 production이어야 합니다." ;; esac
case "$action" in --plan|--apply) ;; *) fail "두 번째 인자는 --plan 또는 --apply여야 합니다." ;; esac

config="$PROJECT_ROOT/deploy/environments/$environment.env"
load_env_file "$config"

: "${DEPLOY_HOST:?DEPLOY_HOST가 필요합니다.}"
: "${DEPLOY_MODE:?DEPLOY_MODE=install 또는 update가 필요합니다.}"
: "${EXPECTED_APP_ENV:?EXPECTED_APP_ENV가 필요합니다.}"
: "${G7_REMOTE_ROOT:?G7_REMOTE_ROOT가 필요합니다.}"
: "${PHP_BIN:=php}"
: "${DEPLOY_RUN_USER:=}"
: "${REMOTE_ARTIFACT_DIR:=/tmp/jwsoft-tiptap-editor}"
: "${SMOKE_URL:?SMOKE_URL이 필요합니다.}"
case "$DEPLOY_MODE" in install|update) ;; *) fail "DEPLOY_MODE는 install 또는 update여야 합니다." ;; esac

for pair in "DEPLOY_HOST:$DEPLOY_HOST" "EXPECTED_APP_ENV:$EXPECTED_APP_ENV" "G7_REMOTE_ROOT:$G7_REMOTE_ROOT" "PHP_BIN:$PHP_BIN" "REMOTE_ARTIFACT_DIR:$REMOTE_ARTIFACT_DIR"; do
  require_safe_token "${pair%%:*}" "${pair#*:}"
done
remote_shell=(bash -s --)
if [ -n "$DEPLOY_RUN_USER" ]; then
  printf '%s' "$DEPLOY_RUN_USER" | grep -Eq '^[a-z_][a-z0-9_-]*$' || fail "DEPLOY_RUN_USER 형식이 안전하지 않습니다."
  remote_shell=(sudo -n -u "$DEPLOY_RUN_USER" -- bash -s --)
fi
printf '%s' "$SMOKE_URL" | grep -Eq '^https?://[A-Za-z0-9._:/?&=%+-]+$' || fail "SMOKE_URL 형식이 안전하지 않습니다."

version="$(node -p "require('$PROJECT_ROOT/package.json').version")"
artifact="${ARTIFACT_PATH:-$PROJECT_ROOT/.build/jwsoft-tiptap-editor-$version.zip}"
[ -f "$artifact" ] || fail "artifact가 없습니다: $artifact"
checksum="$(sha256_file "$artifact")"

if [ "$environment" = "production" ]; then
  [ "${PRODUCTION_APPROVAL:-}" = "jwsoft-tiptap-editor-production" ] \
    || fail "production에는 PRODUCTION_APPROVAL=jwsoft-tiptap-editor-production이 필요합니다."
  [ -n "${APPROVED_STAGING_SHA256:-}" ] || fail "production에는 APPROVED_STAGING_SHA256가 필요합니다."
  [ "$APPROVED_STAGING_SHA256" = "$checksum" ] || fail "staging 승인 checksum과 artifact가 다릅니다."
  DEPLOY_EVIDENCE_CHECKSUM="$checksum" \
  DEPLOY_EVIDENCE_VERSION="$version" \
  DEPLOY_EVIDENCE_TARGET="$DEPLOY_HOST:$G7_REMOTE_ROOT" \
  DEPLOY_EVIDENCE_SAME_TARGET_APPROVED="${SAME_TARGET_PROMOTION_APPROVED:-0}" \
    node "$PROJECT_ROOT/scripts/deploy-evidence.mjs" verify-production
fi

remote_zip="$REMOTE_ARTIFACT_DIR/$(basename "$artifact")"
info "환경: $environment"
info "모드: $DEPLOY_MODE"
info "실행 계정: ${DEPLOY_RUN_USER:-SSH 사용자}"
info "호스트: $DEPLOY_HOST"
info "G7: $G7_REMOTE_ROOT"
info "artifact: $artifact"
info "sha256: $checksum"
info "적용 순서: 원격 사전검증 -> 업로드 -> checksum 검증 -> 플러그인 $DEPLOY_MODE -> sirsoft-ckeditor5 비활성화 -> jwsoft 활성화 -> 캐시 정리 -> smoke"

[ "$action" = "--apply" ] || { info "계획만 출력했습니다. 서버 변경 없음."; exit 0; }

node "$PROJECT_ROOT/scripts/deployment-gate.mjs" "$environment" "$artifact"

require_command ssh
require_command rsync
require_command curl

ssh "$DEPLOY_HOST" "${remote_shell[@]}" \
  "$G7_REMOTE_ROOT" "$PHP_BIN" "$environment" "$EXPECTED_APP_ENV" "$DEPLOY_MODE" \
  < "$PROJECT_ROOT/scripts/remote-deploy-preflight.sh"
ssh "$DEPLOY_HOST" "mkdir -p '$REMOTE_ARTIFACT_DIR'"
rsync -av --checksum "$artifact" "$DEPLOY_HOST:$remote_zip"

ssh "$DEPLOY_HOST" "${remote_shell[@]}" \
  "$G7_REMOTE_ROOT" "$PHP_BIN" "$DEPLOY_MODE" "$remote_zip" "$checksum" <<'REMOTE'
set -Eeuo pipefail
g7_root="$1"
php_bin="$2"
deploy_mode="$3"
artifact="$4"
expected_checksum="$5"

cd "$g7_root"
rollback() {
  local failure_status=$?
  set +e
  "$php_bin" artisan plugin:deactivate jwsoft-tiptap-editor --no-interaction
  "$php_bin" artisan plugin:activate sirsoft-ckeditor5 --no-interaction
  "$php_bin" artisan optimize:clear --no-interaction
  echo '배포 실패: sirsoft-ckeditor5 활성화를 시도했습니다.' >&2
  exit "$failure_status"
}

if command -v sha256sum >/dev/null 2>&1; then
  actual_checksum="$(sha256sum "$artifact" | awk '{print $1}')"
else
  actual_checksum="$(shasum -a 256 "$artifact" | awk '{print $1}')"
fi
[ "$actual_checksum" = "$expected_checksum" ] || { echo '원격 checksum 불일치' >&2; exit 1; }
trap rollback ERR

if [ "$deploy_mode" = "install" ]; then
  pending="plugins/_pending/jwsoft-tiptap-editor"
  [ ! -e "$pending" ] || { echo '기존 JWSoft pending 경로가 있어 덮어쓰지 않습니다.' >&2; exit 1; }
  mkdir -p "$(dirname "$pending")"
  unpack="$(mktemp -d "$(dirname "$pending")/.jwsoft-unpack.XXXXXX")"
  unzip -q "$artifact" -d "$unpack"
  extracted="$unpack/jwsoft-tiptap-editor"
  [ -f "$extracted/plugin.json" ] || { echo 'artifact root가 잘못되었습니다.' >&2; exit 1; }
  mv "$extracted" "$pending"
  rmdir "$unpack"
  "$php_bin" artisan plugin:install jwsoft-tiptap-editor --vendor-mode=bundled --no-interaction
else
  "$php_bin" artisan plugin:update jwsoft-tiptap-editor --zip="$artifact" --force --vendor-mode=bundled --no-interaction
fi

echo '에디터 전환: CKEditor를 비활성화한 뒤 JWSoft를 활성화합니다. 설치·활성화·조회만으로 기존 글의 저장된 본문은 변경되지 않습니다. 기존 글을 JWSoft에서 수정 후 저장할 때 지원하지 않는 서식이 달라질 수 있습니다.'

verify_editor_state() {
  "$php_bin" -r '
  require "vendor/autoload.php";
  $app = require "bootstrap/app.php";
  $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
  $repository = $app->make(App\Contracts\Repositories\PluginRepositoryInterface::class);
  $ready = $repository->findActiveByIdentifier("jwsoft-tiptap-editor") !== null
      && $repository->findActiveByIdentifier("sirsoft-ckeditor5") === null;
  exit($ready ? 0 : 1);
  '
}

"$php_bin" artisan plugin:deactivate sirsoft-ckeditor5 --no-interaction || true
if ! verify_editor_state; then
  "$php_bin" artisan plugin:activate jwsoft-tiptap-editor --no-interaction
fi
verify_editor_state
"$php_bin" artisan optimize:clear --no-interaction
"$php_bin" artisan plugin:list | grep -q 'jwsoft-tiptap-editor'
trap - ERR
REMOTE

curl --fail --silent --show-error --location --max-time 20 "$SMOKE_URL" >/dev/null
DEPLOY_EVIDENCE_ENVIRONMENT="$environment" \
DEPLOY_EVIDENCE_CHECKSUM="$checksum" \
DEPLOY_EVIDENCE_VERSION="$version" \
DEPLOY_EVIDENCE_ARTIFACT="$(basename "$artifact")" \
DEPLOY_EVIDENCE_MODE="$DEPLOY_MODE" \
DEPLOY_EVIDENCE_APP_ENV="$EXPECTED_APP_ENV" \
DEPLOY_EVIDENCE_TARGET="$DEPLOY_HOST:$G7_REMOTE_ROOT" \
DEPLOY_EVIDENCE_SMOKE_URL="$SMOKE_URL" \
DEPLOY_EVIDENCE_SAME_TARGET_APPROVED="${SAME_TARGET_PROMOTION_APPROVED:-0}" \
  node "$PROJECT_ROOT/scripts/deploy-evidence.mjs" record
info "배포와 smoke 통과"
