#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

require_command node
require_command npm
require_command php
require_command composer
require_command git
require_command zip
require_command unzip
require_command ssh
require_command rsync

node -e "const [major, minor, patch] = process.versions.node.split('.').map(Number); const ok = (major === 22 && (minor > 22 || (minor === 22 && patch >= 2))) || (major === 24 && minor >= 15) || major === 26; if (!ok) process.exit(1)" \
  || fail "Node.js 22.22.2+, 24.15.0+ 또는 26.x가 필요합니다. 현재: $(node --version)"

php -r 'exit(version_compare(PHP_VERSION, "8.2.0", ">=") ? 0 : 1);' \
  || fail "PHP 8.2 이상이 필요합니다. 현재: $(php -r 'echo PHP_VERSION;')"

info "Node $(node --version)"
info "npm $(npm --version)"
info "PHP $(php -r 'echo PHP_VERSION;')"
info "Composer $(composer --version --no-ansi | sed 's/Composer version //')"

if [ -n "${G7_ROOT:-}" ]; then
  [ -f "$G7_ROOT/artisan" ] || fail "G7_ROOT에 artisan이 없습니다: $G7_ROOT"
  info "G7 통합 호스트: $G7_ROOT"
else
  info "G7_ROOT 미설정: 독립 저장소 검증만 수행합니다."
fi

info "환경 진단 통과"
