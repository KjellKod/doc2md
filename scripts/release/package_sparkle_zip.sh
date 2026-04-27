#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"
VERSION="${VERSION:-}"
OUTPUT_DIR="${OUTPUT_DIR:-.build/release}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

[[ -d "$APP_PATH" ]] || fail "APP_PATH does not point to an app bundle: $APP_PATH"
[[ -n "$VERSION" ]] || fail "VERSION is required"

mkdir -p "$OUTPUT_DIR"
ZIP_PATH="$OUTPUT_DIR/doc2md-${VERSION}.zip"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

printf 'Created Sparkle ZIP: %s\n' "$ZIP_PATH"
