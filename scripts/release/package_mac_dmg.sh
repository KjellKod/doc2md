#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"
VERSION="${VERSION:-}"
OUTPUT_DIR="${OUTPUT_DIR:-.build/release}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && /bin/pwd)"
BACKGROUND_SOURCE="$REPO_ROOT/apps/macos/dmg/doc2md-dmg-background.png"
DMGBUILD_SETTINGS_TEMPLATE="$REPO_ROOT/apps/macos/dmg/dmgbuild-settings.json"

VOLUME_NAME="doc2md ${VERSION}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

detach_mount() {
  local mount_path="$1"

  [[ -n "$mount_path" ]] || return 0
  hdiutil detach "$mount_path" >/dev/null 2>&1 || hdiutil detach -force "$mount_path" >/dev/null 2>&1
}

mount_self_test() {
  local dmg_path="$1"
  local mount_path="$TEMP_ROOT/self-test-mount"

  mkdir -p "$mount_path"
  SELF_TEST_MOUNT="$mount_path"
  hdiutil attach "$dmg_path" -readonly -nobrowse -noautoopen -mountpoint "$mount_path" >/dev/null

  [[ -d "$mount_path/doc2md.app" ]] || fail "DMG self-test failed: missing doc2md.app at volume root"
  [[ -L "$mount_path/Applications" ]] || fail "DMG self-test failed: Applications is not a symlink"
  [[ "$(readlink "$mount_path/Applications")" == "/Applications" ]] || fail "DMG self-test failed: Applications symlink does not target /Applications"
  [[ -s "$mount_path/.DS_Store" ]] || fail "DMG self-test failed: missing or empty .DS_Store at volume root"
  [[ -f "$mount_path/.background.png" ]] || fail "DMG self-test failed: missing .background.png at volume root"
  cmp -s "$BACKGROUND_SOURCE" "$mount_path/.background.png" || fail "DMG self-test failed: mounted .background.png does not match source artwork"

  # Verify the mounted app survived dmgbuild's copy intact when we are actually
  # in a signed-release path. Skip in dry-run because local Xcode Release builds
  # default to adhoc/linker-signed .app bundles whose unsealed resources fail
  # strict verification independent of our packaging step.
  if [[ -n "${CODESIGN_IDENTITY:-}" && "${RELEASE_DRY_RUN:-0}" != "1" ]]; then
    codesign --verify --deep --strict --verbose=2 "$mount_path/doc2md.app"
  fi

  detach_mount "$mount_path" || fail "DMG self-test failed: could not detach mounted volume at $mount_path"
  SELF_TEST_MOUNT=""
  printf 'DMG self-test passed: layout files, Applications symlink, and mounted app are valid\n'
}

cleanup() {
  detach_mount "${SELF_TEST_MOUNT:-}"
  rm -rf "${TEMP_ROOT:-}"
}

[[ -d "$APP_PATH" ]] || fail "APP_PATH does not point to an app bundle: $APP_PATH"
[[ -n "$VERSION" ]] || fail "VERSION is required"
[[ -f "$BACKGROUND_SOURCE" ]] || fail "missing DMG background source asset: $BACKGROUND_SOURCE"
[[ -f "$DMGBUILD_SETTINGS_TEMPLATE" ]] || fail "missing dmgbuild JSON settings: $DMGBUILD_SETTINGS_TEMPLATE"
command -v dmgbuild >/dev/null 2>&1 || fail "dmgbuild is required. Install with: python3 -m pipx install dmgbuild==1.6.7 --pip-args \"--constraint $REPO_ROOT/requirements-mac-release.txt\""

mkdir -p "$OUTPUT_DIR"
DMG_PATH="$OUTPUT_DIR/doc2md-${VERSION}.dmg"
TEMP_ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-dmg.XXXXXX")"
DMGBUILD_SETTINGS="$TEMP_ROOT/dmgbuild-settings.json"
SELF_TEST_MOUNT=""

trap cleanup EXIT

python3 "$REPO_ROOT/scripts/release/render_dmgbuild_settings.py" \
  --template "$DMGBUILD_SETTINGS_TEMPLATE" \
  --output "$DMGBUILD_SETTINGS" \
  --volume-name "$VOLUME_NAME" \
  --app-path "$APP_PATH" \
  --background-path "$BACKGROUND_SOURCE"

rm -f "$DMG_PATH"
dmgbuild \
  --detach-retries 12 \
  --settings "$DMGBUILD_SETTINGS" \
  "$VOLUME_NAME" \
  "$DMG_PATH"

mount_self_test "$DMG_PATH"

if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
  printf 'Created unsigned dry-run DMG: %s\n' "$DMG_PATH"
  exit 0
fi

[[ -n "${CODESIGN_IDENTITY:-}" ]] || fail "CODESIGN_IDENTITY is required unless RELEASE_DRY_RUN=1"

codesign --force --timestamp --sign "$CODESIGN_IDENTITY" "$DMG_PATH"
codesign --verify --strict --verbose=2 "$DMG_PATH"

printf 'Created signed DMG: %s\n' "$DMG_PATH"
