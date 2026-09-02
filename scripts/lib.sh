#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_ROOT

info() {
  printf '[jwsoft] %s\n' "$*"
}

fail() {
  printf '[jwsoft] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "필수 명령을 찾을 수 없습니다: $1"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

load_env_file() {
  local file="$1"
  local line key value

  [ -f "$file" ] || fail "환경 파일이 없습니다: $file"

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac

    key="${line%%=*}"
    value="${line#*=}"
    printf '%s' "$key" | grep -Eq '^[A-Z][A-Z0-9_]*$' || fail "허용되지 않은 환경 키: $key"
    case "$value" in
      *'$('*|*'`'*) fail "환경 값에 명령 치환 문법을 사용할 수 없습니다: $key" ;;
    esac
    export "$key=$value"
  done < "$file"
}

require_safe_token() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | grep -Eq '^[A-Za-z0-9._/@:+-]+$' || fail "$name 값에 허용되지 않은 문자가 있습니다."
}
