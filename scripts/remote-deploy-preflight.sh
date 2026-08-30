#!/usr/bin/env bash

set -Eeuo pipefail

g7_root="${1:?G7 root is required}"
php_bin="${2:?PHP binary is required}"
deploy_environment="${3:?deploy environment is required}"
expected_app_env="${4:?expected APP_ENV is required}"
deploy_mode="${5:?deploy mode is required}"

case "$deploy_environment" in
  staging|production) ;;
  *) echo '배포 환경은 staging 또는 production이어야 합니다.' >&2; exit 1 ;;
esac

[ -f "$g7_root/artisan" ] || { echo '원격 G7 artisan을 찾을 수 없습니다.' >&2; exit 1; }
[ -f "$g7_root/vendor/autoload.php" ] || { echo '원격 G7 vendor/autoload.php를 찾을 수 없습니다.' >&2; exit 1; }
cd "$g7_root"

runtime_environment="$("$php_bin" -r '
$g7Root = $argv[1];
$environment = "";
$debug = null;
$configFile = $g7Root."/bootstrap/cache/config.php";
if (is_file($configFile)) {
    $config = require $configFile;
    $environment = (string) ($config["app"]["env"] ?? "");
    $debug = isset($config["app"]["debug"]) ? (bool) $config["app"]["debug"] : null;
}
if ($environment === "" || $debug === null) {
    $values = [];
    foreach (file($g7Root."/.env", FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        if (preg_match("/^(APP_ENV|APP_DEBUG)=(.*)$/", trim($line), $match)) {
            $value = trim($match[2]);
            $value = trim($value, "\"");
            $values[$match[1]] = trim($value, chr(39));
        }
    }
    $environment = $environment !== "" ? $environment : (string) ($values["APP_ENV"] ?? "");
    if ($debug === null && isset($values["APP_DEBUG"])) {
        $debug = filter_var($values["APP_DEBUG"], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    }
}
if ($environment === "" || $debug === null) {
    fwrite(STDERR, "APP_ENV 또는 APP_DEBUG를 판정할 수 없습니다.\n");
    exit(1);
}
printf("JW_ENV=%s\nJW_DEBUG=%s\n", $environment, $debug ? "1" : "0");
' "$g7_root")"
actual_app_env="$(printf '%s\n' "$runtime_environment" | sed -n 's/^JW_ENV=//p' | tail -n 1)"
actual_app_debug="$(printf '%s\n' "$runtime_environment" | sed -n 's/^JW_DEBUG=//p' | tail -n 1)"

[ "$actual_app_env" = "$expected_app_env" ] || {
  echo "배포 대상 APP_ENV 불일치: expected=$expected_app_env actual=$actual_app_env" >&2
  exit 1
}
if [ "$deploy_environment" = "production" ]; then
  [ "$actual_app_env" = "production" ] || { echo 'production은 APP_ENV=production이어야 합니다.' >&2; exit 1; }
fi
if [ "$actual_app_env" = "production" ]; then
  [ "$actual_app_debug" = "0" ] || { echo 'production은 APP_DEBUG=false여야 합니다.' >&2; exit 1; }
fi

for relative_path in storage/framework/cache/data storage/framework/views storage/logs bootstrap/cache; do
  absolute_path="$g7_root/$relative_path"
  [ -d "$absolute_path" ] || { echo "원격 필수 디렉터리가 없습니다: $relative_path" >&2; exit 1; }
  while IFS= read -r -d '' candidate; do
    [ -w "$candidate" ] || {
      echo "원격 필수 경로에 쓰기 권한이 없습니다: ${candidate#"$g7_root/"}" >&2
      exit 1
    }
  done < <(find "$absolute_path" \( -type d -o -type f \) -print0 || printf '\0')
done

[ -d "$g7_root/plugins" ] || { echo '원격 plugins 디렉터리가 없습니다.' >&2; exit 1; }
for candidate in "$g7_root/plugins" "$g7_root/plugins/_pending"; do
  if [ -e "$candidate" ] && [ ! -w "$candidate" ]; then
    echo "원격 플러그인 경로에 쓰기 권한이 없습니다: ${candidate#"$g7_root/"}" >&2
    exit 1
  fi
done

plugin_root="$g7_root/plugins/jwsoft-tiptap-editor"
case "$deploy_mode" in
  install)
    [ ! -e "$plugin_root" ] || { echo 'JWSoft가 이미 설치되어 DEPLOY_MODE=update가 필요합니다.' >&2; exit 1; }
    [ ! -e "$g7_root/plugins/_pending/jwsoft-tiptap-editor" ] || { echo '기존 JWSoft pending 경로가 있어 덮어쓰지 않습니다.' >&2; exit 1; }
    ;;
  update)
    [ -f "$plugin_root/plugin.json" ] || { echo 'JWSoft가 설치되지 않아 DEPLOY_MODE=install이 필요합니다.' >&2; exit 1; }
    while IFS= read -r -d '' candidate; do
      [ -w "$candidate" ] || { echo 'JWSoft 설치 경로에 쓰기 권한이 없습니다.' >&2; exit 1; }
    done < <(find "$plugin_root" \( -type d -o -type f \) -print0 || printf '\0')
    ;;
  *)
    echo 'DEPLOY_MODE는 install 또는 update여야 합니다.' >&2
    exit 1
    ;;
esac

printf '[jwsoft] remote preflight passed: APP_ENV=%s APP_DEBUG=%s\n' "$actual_app_env" "$actual_app_debug"
