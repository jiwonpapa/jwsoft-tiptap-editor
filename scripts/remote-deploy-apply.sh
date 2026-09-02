#!/usr/bin/env bash
set -Eeuo pipefail
g7_root="${1:?}"
php_bin="${2:?}"
deploy_mode="${3:?}"
artifact="${4:?}"
expected_checksum="${5:?}"
cd "$g7_root"
if command -v sha256sum >/dev/null 2>&1; then
  actual_checksum="$(sha256sum "$artifact" | awk '{print $1}')"
else
  actual_checksum="$(shasum -a 256 "$artifact" | awk '{print $1}')"
fi
[ "$actual_checksum" = "$expected_checksum" ] || { echo '원격 checksum 불일치' >&2; exit 1; }
case "$deploy_mode" in
  install)
    pending="plugins/_pending/jwsoft-tiptap-editor"
    [ ! -e "$pending" ] || { echo '기존 pending 경로가 있어 덮어쓰지 않습니다.' >&2; exit 1; }
    mkdir -p "$(dirname "$pending")"
    unpack="$(mktemp -d "$(dirname "$pending")/.jwsoft-unpack.XXXXXX")"
    unzip -q "$artifact" -d "$unpack"
    [ -f "$unpack/jwsoft-tiptap-editor/plugin.json" ] || exit 1
    mv "$unpack/jwsoft-tiptap-editor" "$pending"
    rmdir "$unpack"
    "$php_bin" artisan plugin:install jwsoft-tiptap-editor --vendor-mode=bundled --no-interaction
    ;;
  update)
    "$php_bin" artisan plugin:update jwsoft-tiptap-editor --zip="$artifact" --force --vendor-mode=bundled --no-interaction
    ;;
  *) echo '지원하지 않는 적용 모드' >&2; exit 1 ;;
esac
