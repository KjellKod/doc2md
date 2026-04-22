#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="Release"
# Two separate checks so both are portable on BSD grep (macOS default):
# - FORBIDDEN_SYMBOLS is matched with `-w` for whole-word boundaries (no \b, which is a non-POSIX GNU extension).
# - FORBIDDEN_CALL_PATTERN catches Data/String `.write(to:)` via literal punctuation, which does not need word-boundary support.
FORBIDDEN_SYMBOLS='(FileManager|NSOpenPanel|NSSavePanel|FileHandle|replaceItem|replacingItem|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|securityScopedResource)'
FORBIDDEN_CALL_PATTERN='\.write\(to:'
SHELL_BRIDGE_PATH="apps/macos/doc2md/ShellBridge.swift"

usage() {
  printf 'Usage: %s [--configuration Debug|Release]\n' "$(basename "$0")"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

absolute_path() {
  local path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath "$path"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$path"
    return
  fi

  if [[ -d "$path" ]]; then
    cd "$path" && /bin/pwd
    return
  fi

  local dir
  local base
  dir="$(dirname "$path")"
  base="$(basename "$path")"
  printf '%s/%s\n' "$(cd "$dir" && /bin/pwd)" "$base"
}

while (($#)); do
  case "$1" in
    --configuration)
      [[ $# -ge 2 ]] || fail "--configuration requires Debug or Release"
      CONFIGURATION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

case "$CONFIGURATION" in
  Debug|Release) ;;
  *) fail "--configuration must be Debug or Release" ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && /bin/pwd)"

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required but was not found on PATH"
fi

XCODE_SELECT_PATH="not checked because DEVELOPER_DIR was set by the caller"
if [[ -z "${DEVELOPER_DIR:-}" ]]; then
  if ! XCODE_SELECT_PATH="$(xcode-select -p 2>/dev/null)"; then
    printf 'Error: full Xcode is not available.\n' >&2
    printf 'xcode-select -p failed. Install full Xcode, then run:\n' >&2
    printf '  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer\n' >&2
    exit 1
  fi

  if [[ "$XCODE_SELECT_PATH" == "/Library/Developer/CommandLineTools" ]]; then
    export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
  else
    export DEVELOPER_DIR="$XCODE_SELECT_PATH"
  fi
fi

XCODEBUILD_BIN="$DEVELOPER_DIR/usr/bin/xcodebuild"
if [[ ! -x "$XCODEBUILD_BIN" ]]; then
  printf 'Error: full Xcode is not available.\n' >&2
  printf 'Resolved DEVELOPER_DIR: %s\n' "$DEVELOPER_DIR" >&2
  printf 'xcode-select -p: %s\n' "$XCODE_SELECT_PATH" >&2
  printf 'Install full Xcode, then run:\n' >&2
  printf '  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer\n' >&2
  exit 1
fi

cd "$REPO_ROOT"

if grep -nEw "$FORBIDDEN_SYMBOLS" "$SHELL_BRIDGE_PATH"; then
  fail "forbidden API symbol found in $SHELL_BRIDGE_PATH; ShellBridge must remain I/O-free until Phase 3"
fi

if grep -nE "$FORBIDDEN_CALL_PATTERN" "$SHELL_BRIDGE_PATH"; then
  fail "forbidden .write(to:) call found in $SHELL_BRIDGE_PATH; ShellBridge must remain I/O-free until Phase 3"
fi

npm run build:desktop

"$XCODEBUILD_BIN" \
  -project apps/macos/doc2md.xcodeproj \
  -scheme doc2md \
  -configuration "$CONFIGURATION" \
  -derivedDataPath .build/mac \
  build

APP_PATH="$REPO_ROOT/.build/mac/Build/Products/$CONFIGURATION/doc2md.app"
if [[ ! -d "$APP_PATH" ]]; then
  fail "xcodebuild completed, but expected app was not found: $APP_PATH"
fi

printf 'Built: %s\n' "$(absolute_path "$APP_PATH")"
