#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
if [ -f "$PROJECT_ROOT/.env" ]; then
  load_env_file "$PROJECT_ROOT/.env"
fi
: "${G7_ROOT:?전용 G7_ROOT가 필요합니다.}"
cd "$PROJECT_ROOT"
exec "${HARNESS_PYTHON:-python3}" -m harness.jw_harness integration --host "$G7_ROOT"
