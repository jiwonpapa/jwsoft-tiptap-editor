#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

status=0
require_command shellcheck
shellcheck --severity=warning "$PROJECT_ROOT"/scripts/*.sh || status=1
while IFS= read -r script; do
  bash -n "$script" || status=1
  if LC_ALL=C grep -q $'\r' "$script"; then
    printf '[jwsoft] ERROR: CRLF 발견: %s\n' "$script" >&2
    status=1
  fi
done < <(find "$PROJECT_ROOT/scripts" -type f -name '*.sh' | sort)

[ "$status" -eq 0 ] || fail "Shell 정적 검사가 실패했습니다."
info "Shell 정적 검사 통과"
