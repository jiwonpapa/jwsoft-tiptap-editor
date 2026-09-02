#!/usr/bin/env bash
set -Eeuo pipefail
cd "${1:?}"
php_bin="${2:?}"
command="${3:?}"
plugin="${4:-}"
case "$command:$plugin" in
  plugin:activate:jwsoft-tiptap-editor|plugin:activate:sirsoft-ckeditor5|plugin:deactivate:jwsoft-tiptap-editor|plugin:deactivate:sirsoft-ckeditor5)
    exec "$php_bin" artisan "$command" "$plugin" --no-interaction ;;
  optimize:clear:)
    exec "$php_bin" artisan optimize:clear --no-interaction ;;
  *) echo '허용되지 않은 배포 명령' >&2; exit 1 ;;
esac
