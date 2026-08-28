#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

require_command zip
require_command composer
[ -f "$PROJECT_ROOT/dist/js/plugin.iife.js" ] || fail "먼저 make build를 실행하십시오."
[ -f "$PROJECT_ROOT/composer.lock" ] || fail "composer.lock이 없습니다. composer install/update로 잠금 파일을 생성하십시오."

version="$(node -p "require('$PROJECT_ROOT/package.json').version")"
source_date_epoch="${SOURCE_DATE_EPOCH:-$(git -C "$PROJECT_ROOT" log -1 --format=%ct 2>/dev/null || true)}"
source_date_epoch="${source_date_epoch:-315532800}"
export SOURCE_DATE_EPOCH="$source_date_epoch"
case "$version" in
  *-alpha.*)
    info "환경 alpha artifact를 생성합니다. 운영 배포 금지입니다."
    ;;
  *)
    "$PROJECT_ROOT/scripts/parity-gate.sh"
    [ -f "$PROJECT_ROOT/resources/extensions/html-editor.json" ] || fail "stable package에 HtmlEditor 확장이 없습니다."
    [ -f "$PROJECT_ROOT/resources/extensions/html-content.json" ] || fail "stable package에 HtmlContent 확장이 없습니다."
    ;;
esac

build_root="$PROJECT_ROOT/.build/package"
stage="$build_root/jwsoft-tiptap-editor"
artifact="$PROJECT_ROOT/.build/jwsoft-tiptap-editor-$version.zip"
rm -rf "$build_root"
rm -f "$artifact"
mkdir -p "$stage"

for file in plugin.php plugin.json components.json composer.json composer.lock CHANGELOG.md; do
  [ -f "$PROJECT_ROOT/$file" ] || fail "runtime 파일 누락: $file"
  rsync -a "$PROJECT_ROOT/$file" "$stage/$file"
done
for directory in dist policy resources src routes database lang; do
  if [ -d "$PROJECT_ROOT/$directory" ]; then
    mkdir -p "$stage/$directory"
    rsync -a "$PROJECT_ROOT/$directory/" "$stage/$directory/"
  fi
done

COMPOSER_ROOT_VERSION="$version" composer install \
  --working-dir="$stage" \
  --no-dev \
  --no-interaction \
  --prefer-dist \
  --classmap-authoritative

find "$stage/vendor" -exec touch -t 198001010000 {} +
(cd "$stage" && find vendor -type f -o -type l | LC_ALL=C sort | zip -X -q vendor-bundle.zip -@)
node "$PROJECT_ROOT/scripts/build-vendor-bundle.mjs" "$stage"
rm -rf "$stage/vendor"

find "$stage" -exec touch -t 198001010000 {} +
(cd "$build_root" && find jwsoft-tiptap-editor -type f -o -type l | LC_ALL=C sort | zip -X -q "$artifact" -@)

checksum="$(sha256_file "$artifact")"
printf '%s  %s\n' "$checksum" "$(basename "$artifact")" > "$PROJECT_ROOT/.build/SHA256SUMS"

if unzip -l "$artifact" | grep -E '(^|/)(\.env|node_modules|vendor|tests|harness|deploy)(/|$)' >/dev/null; then
  fail "artifact에 개발 전용 또는 비밀 경로가 포함되었습니다."
fi
[ "$(unzip -p "$artifact" jwsoft-tiptap-editor/vendor-bundle.zip | sha256_file /dev/stdin)" = "$(node -p "require('$stage/vendor-bundle.json').zip_sha256")" ] \
  || fail "artifact 내부 vendor bundle checksum이 다릅니다."

info "artifact: $artifact"
info "sha256: $checksum"
