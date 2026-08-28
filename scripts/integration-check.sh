#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

if [ -f "$PROJECT_ROOT/.env" ]; then
  load_env_file "$PROJECT_ROOT/.env"
fi

[ -n "${G7_ROOT:-}" ] || fail "G7_ROOT를 전용 G7 7.0.9+ 테스트 호스트로 설정하십시오."
G7_ROOT="$(cd "$G7_ROOT" && pwd)"
[ "$G7_ROOT" != "$PROJECT_ROOT" ] || fail "제품 저장소와 G7 통합 호스트는 분리해야 합니다."
[ -f "$G7_ROOT/artisan" ] || fail "G7 artisan을 찾을 수 없습니다: $G7_ROOT"
[ -f "$G7_ROOT/config/app.php" ] || fail "G7 config/app.php가 없습니다."

version="$(sed -nE "s/.*'version'[[:space:]]*=>[[:space:]]*env\('[^']+',[[:space:]]*'([^']+)'\).*/\1/p" "$G7_ROOT/config/app.php" | head -1)"
[ -n "$version" ] || fail "G7 기본 버전을 판독할 수 없습니다."
php -r 'exit(version_compare($argv[1], "7.0.9", ">=") ? 0 : 1);' "$version" \
  || fail "G7 7.0.9 이상이 필요합니다. 현재: $version"

if [ -d "$G7_ROOT/.git" ] && [ "${ALLOW_DIRTY_G7:-0}" != "1" ]; then
  [ -z "$(git -C "$G7_ROOT" status --porcelain)" ] \
    || fail "G7 통합 호스트가 dirty입니다. 전용 호스트를 정리하거나 ALLOW_DIRTY_G7=1을 명시하십시오."
fi

commands="$(cd "$G7_ROOT" && php artisan list --raw 2>/dev/null)"
for command in plugin:install plugin:update plugin:activate plugin:deactivate plugin:list; do
  printf '%s\n' "$commands" | grep -q "^$command" || fail "G7 명령이 없습니다: $command"
done

install_help="$(cd "$G7_ROOT" && php artisan plugin:install --help 2>/dev/null)"
update_help="$(cd "$G7_ROOT" && php artisan plugin:update --help 2>/dev/null)"
printf '%s' "$install_help" | grep -q -- '--vendor-mode' || fail "plugin:install vendor-mode 계약이 없습니다."
printf '%s' "$update_help" | grep -q -- '--zip' || fail "plugin:update --zip 계약이 없습니다."

php "$PROJECT_ROOT/tests/integration/g7_middleware_test.php" "$G7_ROOT" "$PROJECT_ROOT"
php "$PROJECT_ROOT/tests/integration/g7_image_subsystem_test.php" "$G7_ROOT" "$PROJECT_ROOT"
php "$PROJECT_ROOT/tests/integration/g7_media_subsystem_test.php" "$G7_ROOT" "$PROJECT_ROOT"
node "$PROJECT_ROOT/scripts/write-integration-evidence.mjs" "$version"

info "G7 $version 통합 호스트 계약 검사 통과: $G7_ROOT"
