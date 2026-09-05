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
if [ -n "$DEPLOY_RUN_USER" ]; then
  printf '%s' "$DEPLOY_RUN_USER" | grep -Eq '^[a-z_][a-z0-9_-]*$' || fail "DEPLOY_RUN_USER 형식이 안전하지 않습니다."
fi
export PHP_BIN DEPLOY_RUN_USER REMOTE_ARTIFACT_DIR
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

info "환경: $environment"
info "모드: $DEPLOY_MODE"
info "실행 계정: ${DEPLOY_RUN_USER:-SSH 사용자}"
info "호스트: $DEPLOY_HOST"
info "G7: $G7_REMOTE_ROOT"
info "artifact: $artifact"
info "sha256: $checksum"
info "적용 순서: 원격 사전검증 -> 업로드 -> checksum 검증 -> 플러그인 $DEPLOY_MODE -> sirsoft-ckeditor5 비활성화 -> jwsoft 활성화 -> 캐시 정리 -> smoke"

[ "$action" = "--apply" ] || { info "계획만 출력했습니다. 서버 변경 없음."; exit 0; }

require_command ssh
require_command rsync
require_command curl

# Python owns apply + HTTP smoke + state-aware compensation.
(cd "$PROJECT_ROOT" && "${HARNESS_PYTHON:-python3}" -m harness.jw_harness deploy-transaction \
  --environment "$environment" --artifact "$artifact" --apply)
info "배포와 smoke 통과"
