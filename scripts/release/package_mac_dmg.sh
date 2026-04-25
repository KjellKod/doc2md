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
DMG_PATH="$OUTPUT_DIR/doc2md-${VERSION}.dmg"
STAGING_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-dmg.XXXXXX")"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

cp -R "$APP_PATH" "$STAGING_DIR/doc2md.app"
hdiutil create -volname "doc2md ${VERSION}" -srcfolder "$STAGING_DIR" -ov -format UDZO "$DMG_PATH"

if [[ "${RELEASE_DRY_RUN:-0}" == "1" || -z "${CODESIGN_IDENTITY:-}" ]]; then
  printf 'Created unsigned dry-run DMG: %s\n' "$DMG_PATH"
  exit 0
fi

codesign --force --timestamp --sign "$CODESIGN_IDENTITY" "$DMG_PATH"
codesign --verify --deep --strict --verbose=2 "$DMG_PATH"

printf 'Created signed DMG: %s\n' "$DMG_PATH"
