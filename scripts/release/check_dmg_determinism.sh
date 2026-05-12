#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"
VERSION="${VERSION:-determinism-test}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && /bin/pwd)"
fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

# Resolve the dmgbuild venv Python without requiring the caller to export
# PIPX_HOME. Locally, "pipx install dmgbuild" puts the shim on PATH but does
# not export PIPX_HOME; reading the shim's shebang gives us the exact venv
# interpreter dmgbuild itself uses, so ds_store and mac_alias imports work.
PYTHON="${DMGBUILD_PYTHON:-}"

if [[ -z "$PYTHON" ]]; then
  if [[ -n "${PIPX_HOME:-}" && -x "$PIPX_HOME/venvs/dmgbuild/bin/python" ]]; then
    PYTHON="$PIPX_HOME/venvs/dmgbuild/bin/python"
  elif dmgbuild_bin="$(command -v dmgbuild 2>/dev/null)"; then
    shim_python="$(head -n1 "$dmgbuild_bin" 2>/dev/null | sed -n 's|^#!||p')"
    if [[ -n "$shim_python" && -x "$shim_python" ]]; then
      PYTHON="$shim_python"
    fi
  fi
fi

if [[ -z "$PYTHON" ]]; then
  fail "could not resolve the dmgbuild venv Python. Install with 'brew install pipx && pipx install dmgbuild==1.6.7 --pip-args \"--constraint \$PWD/requirements-mac-release.txt\"', or set DMGBUILD_PYTHON to a Python that imports ds_store and mac_alias."
fi

detach_mount() {
  local target="$1"
  [[ -n "$target" ]] || return 0
  local normal_output
  local normal_status
  local force_output
  local force_status

  if normal_output="$(hdiutil detach "$target" 2>&1)"; then
    return 0
  fi
  normal_status=$?

  if force_output="$(hdiutil detach -force "$target" 2>&1)"; then
    return 0
  fi
  force_status=$?

  printf 'Error: failed to detach %s (normal exit %s: %s; force exit %s: %s)\n' \
    "$target" \
    "$normal_status" \
    "$normal_output" \
    "$force_status" \
    "$force_output" >&2
  return 1
}

mount_readonly() {
  local dmg_path="$1"
  local mount_path="$2"
  local plist_path="$3"

  hdiutil attach "$dmg_path" -readonly -nobrowse -noautoopen -mountpoint "$mount_path" -plist >"$plist_path"
  python3 - "$plist_path" "$mount_path" <<'PY'
import plistlib
import sys

with open(sys.argv[1], "rb") as handle:
    data = plistlib.load(handle)

expected_mount = sys.argv[2]
for entity in data.get("system-entities", []):
    if entity.get("mount-point") == expected_mount and entity.get("dev-entry"):
        print(entity["dev-entry"])
        raise SystemExit(0)

print(expected_mount)
PY
}

records_json() {
  local mount_path="$1"
  "$PYTHON" "$REPO_ROOT/tests/release/dmg_layout_assertions.py" records "$mount_path"
}

compare_records() {
  local first_json="$1"
  local second_json="$2"

  python3 - "$first_json" "$second_json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    first = json.load(handle)
with open(sys.argv[2], encoding="utf-8") as handle:
    second = json.load(handle)

if first == second:
    raise SystemExit(0)

keys = sorted(set(first) | set(second))
for key in keys:
    if first.get(key) != second.get(key):
        print(
            f"determinism mismatch for {key}: "
            f"first={first.get(key)!r} second={second.get(key)!r}",
            file=sys.stderr,
        )
raise SystemExit(1)
PY
}

[[ -d "$APP_PATH" ]] || fail "APP_PATH does not point to an app bundle: $APP_PATH"
"$PYTHON" -c "import ds_store, mac_alias" >/dev/null
APP_PATH="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$APP_PATH")"

TMP_ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-dmg-determinism.XXXXXX")"
MOUNT1="$TMP_ROOT/mount1"
MOUNT2="$TMP_ROOT/mount2"
DEVICE1=""
DEVICE2=""

cleanup() {
  local status=0
  detach_mount "$DEVICE1" || status=1
  detach_mount "$DEVICE2" || status=1
  rm -rf "$TMP_ROOT"
  return "$status"
}
trap cleanup EXIT

mkdir -p "$TMP_ROOT/out1" "$TMP_ROOT/out2" "$MOUNT1" "$MOUNT2"

(
  cd "$REPO_ROOT"
  RELEASE_DRY_RUN=1 VERSION="$VERSION" APP_PATH="$APP_PATH" OUTPUT_DIR="$TMP_ROOT/out1" bash scripts/release/package_mac_dmg.sh
  RELEASE_DRY_RUN=1 VERSION="$VERSION" APP_PATH="$APP_PATH" OUTPUT_DIR="$TMP_ROOT/out2" bash scripts/release/package_mac_dmg.sh
)

DMG1="$TMP_ROOT/out1/doc2md-${VERSION}.dmg"
DMG2="$TMP_ROOT/out2/doc2md-${VERSION}.dmg"
[[ -f "$DMG1" ]] || fail "first determinism DMG was not created: $DMG1"
[[ -f "$DMG2" ]] || fail "second determinism DMG was not created: $DMG2"

DEVICE1="$(mount_readonly "$DMG1" "$MOUNT1" "$TMP_ROOT/attach1.plist")"
DEVICE2="$(mount_readonly "$DMG2" "$MOUNT2" "$TMP_ROOT/attach2.plist")"

cmp "$MOUNT1/.background.png" "$MOUNT2/.background.png"
records_json "$MOUNT1" >"$TMP_ROOT/records1.json"
records_json "$MOUNT2" >"$TMP_ROOT/records2.json"
compare_records "$TMP_ROOT/records1.json" "$TMP_ROOT/records2.json"

if ! cleanup; then
  trap - EXIT
  exit 1
fi
trap - EXIT
printf 'DMG determinism check passed: structural .DS_Store records and .background.png match\n'
