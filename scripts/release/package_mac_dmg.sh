#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"
VERSION="${VERSION:-}"
OUTPUT_DIR="${OUTPUT_DIR:-.build/release}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && /bin/pwd)"
BACKGROUND_SOURCE="$REPO_ROOT/apps/macos/dmg/doc2md-dmg-background.png"

VOLUME_NAME="doc2md ${VERSION}"
BACKGROUND_NAME="doc2md-dmg-background.png"
LAYOUT_TIMEOUT_SECONDS=30
LAYOUT_ATTEMPTS=3
LAYOUT_RETRY_SLEEP_SECONDS=2
LAYOUT_OVERALL_TIMEOUT_SECONDS=90
FINDER_SYNC_DELAY=2

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

warn() {
  printf 'WARNING: %s\n' "$*" >&2
}

append_step_summary() {
  local title="$1"
  local body="$2"

  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      printf '### %s\n\n' "$title"
      printf '```text\n%s\n```\n\n' "$body"
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

detach_mount() {
  local mount_path="$1"

  [[ -n "$mount_path" ]] || return 0
  hdiutil detach "$mount_path" >/dev/null 2>&1 || hdiutil detach -force "$mount_path" >/dev/null 2>&1
}

run_osascript_with_timeout() {
  local script_path="$1"
  local timeout_seconds="$2"

  python3 - "$script_path" "$timeout_seconds" <<'PY'
import subprocess
import sys

script_path = sys.argv[1]
timeout_seconds = int(sys.argv[2])

try:
    result = subprocess.run(
        ["osascript", script_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
except subprocess.TimeoutExpired as exc:
    if exc.stdout:
        print(exc.stdout, end="")
    if exc.stderr:
        print(exc.stderr, end="")
    print(f"osascript timed out after {timeout_seconds}s")
    raise SystemExit(124)

print(result.stdout, end="")
raise SystemExit(result.returncode)
PY
}

write_layout_applescript() {
  local script_path="$1"
  local mount_path="$2"
  local background_path="$3"

  cat >"$script_path" <<OSA
tell application "Finder"
  set volumeFolder to POSIX file "$mount_path" as alias
  set backgroundFile to POSIX file "$background_path"
  open volumeFolder
  delay 1
  set volumeWindow to front Finder window
  tell volumeWindow
    set current view to icon view
    set toolbar visible to false
    set statusbar visible to false
    set bounds to {100, 100, 820, 560}
  end tell
  set viewOptions to icon view options of volumeWindow
  set arrangement of viewOptions to not arranged
  set icon size of viewOptions to 96
  set background picture of viewOptions to backgroundFile
  set position of item "doc2md.app" of volumeWindow to {190, 205}
  set position of item "Applications" of volumeWindow to {515, 205}
  update volumeFolder without registering applications
  delay 1
  close volumeWindow
  open volumeFolder
  update volumeFolder without registering applications
end tell
OSA
}

apply_finder_layout() {
  local mount_path="$1"
  local background_path="$2"
  local script_path="$TEMP_ROOT/dmg-layout.applescript"
  local output_path="$TEMP_ROOT/dmg-layout-output.log"
  local start_time
  local attempt

  write_layout_applescript "$script_path" "$mount_path" "$background_path"
  : >"$output_path"
  start_time="$(date +%s)"

  for ((attempt = 1; attempt <= LAYOUT_ATTEMPTS; attempt++)); do
    local now elapsed remaining timeout status
    now="$(date +%s)"
    elapsed=$((now - start_time))
    remaining=$((LAYOUT_OVERALL_TIMEOUT_SECONDS - elapsed))
    if ((remaining <= 0)); then
      break
    fi

    timeout="$LAYOUT_TIMEOUT_SECONDS"
    if ((remaining < timeout)); then
      timeout="$remaining"
    fi

    status=0
    {
      printf 'Finder layout attempt %s/%s with %ss timeout\n' "$attempt" "$LAYOUT_ATTEMPTS" "$timeout"
      run_osascript_with_timeout "$script_path" "$timeout"
    } >>"$output_path" 2>&1 || status=$?

    if ((status == 0)); then
      cat "$output_path"
      return 0
    fi

    if ((attempt < LAYOUT_ATTEMPTS)); then
      sleep "$LAYOUT_RETRY_SLEEP_SECONDS"
    fi
  done

  cat "$output_path" >&2
  append_step_summary "DMG Finder layout failure" "$(cat "$output_path")"
  return 1
}

mount_self_test() {
  local dmg_path="$1"
  local mount_path="$TEMP_ROOT/self-test-mount"

  mkdir -p "$mount_path"
  SELF_TEST_MOUNT="$mount_path"
  hdiutil attach "$dmg_path" -readonly -nobrowse -noautoopen -mountpoint "$mount_path" >/dev/null

  [[ -d "$mount_path/doc2md.app" ]] || fail "DMG self-test failed: missing doc2md.app at volume root"
  [[ -e "$mount_path/Applications" ]] || fail "DMG self-test failed: missing Applications at volume root"

  detach_mount "$mount_path" || fail "DMG self-test failed: could not detach mounted volume at $mount_path"
  SELF_TEST_MOUNT=""
  printf 'DMG self-test passed: found doc2md.app and Applications at volume root\n'
}

attach_readwrite_dmg() {
  local dmg_path="$1"
  local attach_plist="$TEMP_ROOT/rw-attach.plist"

  hdiutil attach "$dmg_path" -readwrite -noverify -noautoopen -plist >"$attach_plist"
  python3 - "$attach_plist" <<'PY'
import plistlib
import sys

with open(sys.argv[1], "rb") as handle:
    data = plistlib.load(handle)

for entity in data.get("system-entities", []):
    mount_point = entity.get("mount-point")
    if mount_point:
        print(mount_point)
        raise SystemExit(0)

raise SystemExit(1)
PY
}

cleanup() {
  detach_mount "${SELF_TEST_MOUNT:-}"
  detach_mount "${RW_MOUNT:-}"
  rm -rf "${TEMP_ROOT:-}"
}

[[ -d "$APP_PATH" ]] || fail "APP_PATH does not point to an app bundle: $APP_PATH"
[[ -n "$VERSION" ]] || fail "VERSION is required"
[[ -f "$BACKGROUND_SOURCE" ]] || fail "missing DMG background source asset: $BACKGROUND_SOURCE"

mkdir -p "$OUTPUT_DIR"
DMG_PATH="$OUTPUT_DIR/doc2md-${VERSION}.dmg"
TEMP_ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-dmg.XXXXXX")"
STAGING_DIR="$TEMP_ROOT/staging"
RW_DMG="$TEMP_ROOT/doc2md-${VERSION}.rw.dmg"
RW_MOUNT=""
SELF_TEST_MOUNT=""

trap cleanup EXIT

mkdir -p "$STAGING_DIR/.background"
ditto -rsrc "$APP_PATH" "$STAGING_DIR/doc2md.app"
ln -s /Applications "$STAGING_DIR/Applications"
cp "$BACKGROUND_SOURCE" "$STAGING_DIR/.background/$BACKGROUND_NAME"

if command -v SetFile >/dev/null 2>&1; then
  SetFile -a V "$STAGING_DIR/.background" || true
fi

rm -f "$DMG_PATH"
hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDRW \
  "$RW_DMG" >/dev/null

RW_MOUNT="$(attach_readwrite_dmg "$RW_DMG")" || fail "failed to attach read-write DMG"

if ! apply_finder_layout "$RW_MOUNT" "$RW_MOUNT/.background/$BACKGROUND_NAME"; then
  if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
    warn "Finder layout AppleScript failed; producing icon-only DMG. See docs/runbooks/dmg-applescript-failure.md."
  else
    fail "Finder layout AppleScript failed after ${LAYOUT_ATTEMPTS} attempts; release DMG packaging stopped"
  fi
fi

sync
# Finder metadata writes can lag behind AppleScript success; this small bounded delay
# is separate from the 90s AppleScript layout ceiling above.
sleep "$FINDER_SYNC_DELAY"
detach_mount "$RW_MOUNT" || fail "failed to detach read-write DMG mount at $RW_MOUNT"
RW_MOUNT=""

hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_PATH" >/dev/null
mount_self_test "$DMG_PATH"

if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
  printf 'Created unsigned dry-run DMG: %s\n' "$DMG_PATH"
  exit 0
fi

[[ -n "${CODESIGN_IDENTITY:-}" ]] || fail "CODESIGN_IDENTITY is required unless RELEASE_DRY_RUN=1"

codesign --force --timestamp --sign "$CODESIGN_IDENTITY" "$DMG_PATH"
codesign --verify --strict --verbose=2 "$DMG_PATH"

printf 'Created signed DMG: %s\n' "$DMG_PATH"
