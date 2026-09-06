#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-doc2md-Desktop
set -euo pipefail

DEBUG_APP=".build/mac/Build/Products/Debug/doc2md.app"
RELEASE_APP=".build/mac/Build/Products/Release/doc2md.app"
HOOK_KEY="DOC2MD_TEST_LICENSE_STATE"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

contains_string() {
  local file="$1"
  local value="$2"
  local status=0

  set +e
  strings "$file" | grep -F "$value" >/dev/null
  status=$?
  set -e

  case "$status" in
    0) return 0 ;;
    1) return 1 ;;
    *) fail "Could not inspect executable strings: $file" ;;
  esac
}

[[ -f "$DEBUG_APP/Contents/Resources/Web/index.html" ]] \
  || fail "Debug bundle is missing Contents/Resources/Web/index.html"
[[ -x "$DEBUG_APP/Contents/MacOS/doc2md" ]] || fail "Debug executable is missing"
[[ -x "$RELEASE_APP/Contents/MacOS/doc2md" ]] || fail "Release executable is missing"

contains_string "$DEBUG_APP/Contents/MacOS/doc2md" "$HOOK_KEY" \
  || fail "Debug executable does not contain the document-library smoke hook"
if contains_string "$RELEASE_APP/Contents/MacOS/doc2md" "$HOOK_KEY"; then
  fail "Release executable contains the Debug-only document-library smoke hook"
fi

printf 'Document Library smoke builds verified.\n'
