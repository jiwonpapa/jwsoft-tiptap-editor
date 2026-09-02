#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

[ "$#" -eq 6 ] || fail "사용법: $0 G7_ROOT PREVIOUS_ZIP CURRENT_ZIP PAGE_ID POST_ID PRODUCT_ID"
g7_root="$(cd "$1" && pwd)"
(cd "$PROJECT_ROOT" && "${HARNESS_PYTHON:-python3}" -m harness.jw_harness host-check --root "$g7_root")
previous_artifact="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
current_artifact="$(cd "$(dirname "$3")" && pwd)/$(basename "$3")"
page_id="$4"
post_id="$5"
product_id="$6"

[ "$g7_root" != "$PROJECT_ROOT" ] || fail "제품 저장소를 lifecycle 하네스로 사용할 수 없습니다."
[ -f "$g7_root/artisan" ] || fail "G7 artisan을 찾을 수 없습니다."
[ -f "$g7_root/storage/app/g7_installed" ] || fail "설치 완료된 전용 G7 하네스가 아닙니다."
grep -q '^APP_ENV=local$' "$g7_root/.env" || fail "local G7 하네스만 허용합니다."
[ -f "$previous_artifact" ] || fail "이전 ZIP이 없습니다: $previous_artifact"
[ -f "$current_artifact" ] || fail "현재 ZIP이 없습니다: $current_artifact"

previous_version="$(unzip -p "$previous_artifact" jwsoft-tiptap-editor/plugin.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).version))")"
current_version="$(unzip -p "$current_artifact" jwsoft-tiptap-editor/plugin.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).version))")"
[ "$previous_version" != "$current_version" ] || fail "이전/현재 ZIP 버전이 같습니다."

evidence_dir="$PROJECT_ROOT/test-results/parity/lifecycle"
mkdir -p "$evidence_dir"
probe="$PROJECT_ROOT/tests/integration/g7_lifecycle_probe.php"

php "$probe" "$g7_root" "$previous_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/before.json"

(cd "$g7_root" && php artisan plugin:update jwsoft-tiptap-editor \
  --zip="$current_artifact" --force --vendor-mode=bundled --layout-strategy=overwrite --no-interaction)
php "$probe" "$g7_root" "$current_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/updated.json"

set +e
(cd "$g7_root" && php artisan plugin:activate sirsoft-ckeditor5 --no-interaction) > "$evidence_dir/conflict.log" 2>&1
conflict_exit="$?"
set -e
[ "$conflict_exit" -ne 0 ] || fail "CKEditor 동시 활성화가 차단되지 않았습니다."

(cd "$g7_root" && php artisan plugin:deactivate jwsoft-tiptap-editor --no-interaction)
(cd "$g7_root" && php artisan plugin:activate sirsoft-ckeditor5 --no-interaction)
php "$probe" "$g7_root" "$current_version" inactive active "$page_id" "$post_id" "$product_id" > "$evidence_dir/rollback.json"

(cd "$g7_root" && php artisan plugin:deactivate sirsoft-ckeditor5 --no-interaction)
(cd "$g7_root" && php artisan plugin:activate jwsoft-tiptap-editor --no-interaction)
(cd "$g7_root" && php artisan optimize:clear --no-interaction)
(cd "$g7_root" && php artisan extension:update-autoload --no-interaction)
php "$probe" "$g7_root" "$current_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/restored.json"

node "$PROJECT_ROOT/scripts/write-lifecycle-evidence.mjs" \
  "$previous_artifact" "$current_artifact" \
  "$evidence_dir/before.json" "$evidence_dir/updated.json" \
  "$evidence_dir/rollback.json" "$evidence_dir/restored.json"
