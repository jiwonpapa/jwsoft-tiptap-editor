#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

environment="${1:-}"
action="${2:---plan}"
[ -n "$environment" ] || fail "환경 이름이 필요합니다. 예: staging"
require_safe_token "환경" "$environment"
case "$action" in --plan|--apply) ;; *) fail "두 번째 인자는 --plan 또는 --apply여야 합니다." ;; esac

config="$PROJECT_ROOT/deploy/environments/$environment.env"
load_env_file "$config"

: "${DEPLOY_HOST:?DEPLOY_HOST가 필요합니다.}"
: "${DEPLOY_MODE:?DEPLOY_MODE=install 또는 update가 필요합니다.}"
: "${G7_REMOTE_ROOT:?G7_REMOTE_ROOT가 필요합니다.}"
: "${PHP_BIN:=php}"
: "${REMOTE_ARTIFACT_DIR:=/tmp/jwsoft-tiptap-editor}"
: "${SMOKE_URL:?SMOKE_URL이 필요합니다.}"
case "$DEPLOY_MODE" in install|update) ;; *) fail "DEPLOY_MODE는 install 또는 update여야 합니다." ;; esac

for pair in "DEPLOY_HOST:$DEPLOY_HOST" "G7_REMOTE_ROOT:$G7_REMOTE_ROOT" "PHP_BIN:$PHP_BIN" "REMOTE_ARTIFACT_DIR:$REMOTE_ARTIFACT_DIR"; do
  require_safe_token "${pair%%:*}" "${pair#*:}"
done
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
fi

remote_zip="$REMOTE_ARTIFACT_DIR/$(basename "$artifact")"
info "환경: $environment"
info "모드: $DEPLOY_MODE"
info "호스트: $DEPLOY_HOST"
info "G7: $G7_REMOTE_ROOT"
info "artifact: $artifact"
info "sha256: $checksum"
info "적용 순서: 업로드 -> 원격 검증 -> 플러그인 $DEPLOY_MODE -> sirsoft-ckeditor5 비활성화 -> jwsoft 활성화 -> 캐시 정리 -> smoke"

[ "$action" = "--apply" ] || { info "계획만 출력했습니다. 서버 변경 없음."; exit 0; }

require_command ssh
require_command rsync
require_command curl

ssh "$DEPLOY_HOST" "mkdir -p '$REMOTE_ARTIFACT_DIR'"
rsync -av --checksum "$artifact" "$DEPLOY_HOST:$remote_zip"

ssh "$DEPLOY_HOST" bash -s -- \
  "$G7_REMOTE_ROOT" "$PHP_BIN" "$DEPLOY_MODE" "$remote_zip" "$checksum" <<'REMOTE'
set -Eeuo pipefail
g7_root="$1"
php_bin="$2"
deploy_mode="$3"
artifact="$4"
expected_checksum="$5"

cd "$g7_root"
rollback() {
  set +e
  "$php_bin" artisan plugin:deactivate jwsoft-tiptap-editor --no-interaction
  "$php_bin" artisan plugin:activate sirsoft-ckeditor5 --no-interaction
  "$php_bin" artisan optimize:clear --no-interaction
  echo '배포 실패: sirsoft-ckeditor5 활성화를 시도했습니다.' >&2
}
trap rollback ERR

if command -v sha256sum >/dev/null 2>&1; then
  actual_checksum="$(sha256sum "$artifact" | awk '{print $1}')"
else
  actual_checksum="$(shasum -a 256 "$artifact" | awk '{print $1}')"
fi
[ "$actual_checksum" = "$expected_checksum" ] || { echo '원격 checksum 불일치' >&2; exit 1; }

if [ "$deploy_mode" = "install" ]; then
  pending="plugins/_pending/jwsoft-tiptap-editor"
  rm -rf "$pending"
  mkdir -p "$pending"
  unzip -q "$artifact" -d "$(dirname "$pending")/.jwsoft-unpack"
  extracted="$(dirname "$pending")/.jwsoft-unpack/jwsoft-tiptap-editor"
  [ -f "$extracted/plugin.json" ] || { echo 'artifact root가 잘못되었습니다.' >&2; exit 1; }
  mv "$extracted" "$pending"
  rm -rf "$(dirname "$pending")/.jwsoft-unpack"
  "$php_bin" artisan plugin:install jwsoft-tiptap-editor --vendor-mode=bundled --no-interaction
else
  "$php_bin" artisan plugin:update jwsoft-tiptap-editor --zip="$artifact" --force --vendor-mode=bundled --no-interaction
fi

"$php_bin" artisan plugin:deactivate sirsoft-ckeditor5 --no-interaction || true
"$php_bin" artisan plugin:activate jwsoft-tiptap-editor --no-interaction
"$php_bin" artisan optimize:clear --no-interaction
"$php_bin" artisan plugin:list | grep -q 'jwsoft-tiptap-editor'
trap - ERR
REMOTE

curl --fail --silent --show-error --location --max-time 20 "$SMOKE_URL" >/dev/null
info "배포와 smoke 통과"
