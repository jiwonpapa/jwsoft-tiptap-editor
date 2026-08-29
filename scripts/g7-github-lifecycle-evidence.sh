#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

[ "$#" -eq 5 ] || fail "사용법: $0 G7_ROOT PREVIOUS_ZIP PAGE_ID POST_ID PRODUCT_ID"
g7_root="$(cd "$1" && pwd)"
previous_artifact="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
page_id="$3"
post_id="$4"
product_id="$5"
github_url="https://github.com/jiwonpapa/jwsoft-tiptap-editor"

[ "$g7_root" != "$PROJECT_ROOT" ] || fail "제품 저장소를 GitHub lifecycle 하네스로 사용할 수 없습니다."
[ -f "$g7_root/artisan" ] || fail "G7 artisan을 찾을 수 없습니다."
[ -f "$g7_root/storage/app/g7_installed" ] || fail "설치 완료된 전용 G7 하네스가 아닙니다."
grep -q '^APP_ENV=local$' "$g7_root/.env" || fail "local G7 하네스만 허용합니다."
[ -f "$previous_artifact" ] || fail "이전 ZIP이 없습니다: $previous_artifact"

current_version="$(node -p "require('$PROJECT_ROOT/package.json').version")"
previous_version="$(unzip -p "$previous_artifact" jwsoft-tiptap-editor/plugin.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).version))")"
[ "$previous_version" != "$current_version" ] || fail "이전/현재 버전이 같습니다."
remote_commit="$(git ls-remote "$github_url.git" refs/heads/main | awk '{print $1}')"
[ -n "$remote_commit" ] || fail "공개 GitHub main commit을 확인할 수 없습니다."
[ "$remote_commit" = "$(git -C "$PROJECT_ROOT" rev-parse HEAD)" ] \
  || fail "공개 GitHub main과 현재 commit이 다릅니다. 먼저 main을 push하십시오."

evidence_dir="$PROJECT_ROOT/test-results/parity/github-lifecycle"
mkdir -p "$evidence_dir"
action="$PROJECT_ROOT/tests/integration/g7_remote_plugin_action.php"
content_probe="$PROJECT_ROOT/tests/integration/g7_content_probe.php"
lifecycle_probe="$PROJECT_ROOT/tests/integration/g7_lifecycle_probe.php"

php "$content_probe" "$g7_root" "$page_id" "$post_id" "$product_id" > "$evidence_dir/baseline.json"

(cd "$g7_root" && php artisan plugin:deactivate jwsoft-tiptap-editor --no-interaction)
(cd "$g7_root" && php artisan plugin:uninstall jwsoft-tiptap-editor --force --no-interaction)
php "$content_probe" "$g7_root" "$page_id" "$post_id" "$product_id" > "$evidence_dir/uninstalled.json"

php "$action" "$g7_root" install-github "$github_url" > "$evidence_dir/github-install.json"
php "$action" "$g7_root" acknowledge > "$evidence_dir/acknowledged.json"
(cd "$g7_root" && php artisan plugin:activate jwsoft-tiptap-editor --no-interaction)
php "$lifecycle_probe" "$g7_root" "$current_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/github-active.json"

(cd "$g7_root" && php artisan plugin:deactivate jwsoft-tiptap-editor --no-interaction)
(cd "$g7_root" && php artisan plugin:uninstall jwsoft-tiptap-editor --force --no-interaction)
php "$action" "$g7_root" install-zip "$previous_artifact" > "$evidence_dir/previous-install.json"
php "$action" "$g7_root" acknowledge > "$evidence_dir/previous-acknowledged.json"
(cd "$g7_root" && php artisan plugin:activate jwsoft-tiptap-editor --no-interaction)
php "$lifecycle_probe" "$g7_root" "$previous_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/previous.json"

(cd "$g7_root" && php artisan plugin:update jwsoft-tiptap-editor \
  --source=github --force --vendor-mode=bundled --layout-strategy=overwrite --no-interaction)
php "$lifecycle_probe" "$g7_root" "$current_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/updated.json"

(cd "$g7_root" && php artisan plugin:deactivate jwsoft-tiptap-editor --no-interaction)
(cd "$g7_root" && php artisan plugin:activate sirsoft-ckeditor5 --no-interaction)
php "$lifecycle_probe" "$g7_root" "$current_version" inactive active "$page_id" "$post_id" "$product_id" > "$evidence_dir/rollback.json"
(cd "$g7_root" && php artisan plugin:deactivate sirsoft-ckeditor5 --no-interaction)
(cd "$g7_root" && php artisan plugin:activate jwsoft-tiptap-editor --no-interaction)
(cd "$g7_root" && php artisan optimize:clear --no-interaction)
(cd "$g7_root" && php artisan extension:update-autoload --no-interaction)
php "$lifecycle_probe" "$g7_root" "$current_version" active inactive "$page_id" "$post_id" "$product_id" > "$evidence_dir/restored.json"

node "$PROJECT_ROOT/scripts/write-github-lifecycle-evidence.mjs" \
  "$remote_commit" "$previous_artifact" \
  "$evidence_dir/github-install.json" "$evidence_dir/baseline.json" \
  "$evidence_dir/uninstalled.json" "$evidence_dir/github-active.json" \
  "$evidence_dir/previous.json" "$evidence_dir/updated.json" \
  "$evidence_dir/rollback.json" "$evidence_dir/restored.json"
