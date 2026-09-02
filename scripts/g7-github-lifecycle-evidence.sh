#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
[ "$#" -eq 5 ] || fail "사용법: $0 G7_ROOT PREVIOUS_ZIP PAGE_ID POST_ID PRODUCT_ID"
cd "$PROJECT_ROOT"
exec "${HARNESS_PYTHON:-python3}" -m harness.jw_harness lifecycle \
  --host "$1" --previous "$2" --records "$3" "$4" "$5" --github
