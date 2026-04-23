#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="Release"
PERSISTENCE_SWIFT_SOURCE_GLOB="apps/macos/doc2md/*.swift"
NATIVE_API_ALLOWLIST=(
  "FileManager :: stat/read/temp-file creation/atomic replacement staging for user-selected Markdown files"
  "NSOpenPanel :: user-selected Markdown/text open panel"
  "NSSavePanel :: user-selected Save As target panel"
  "NSWorkspace :: Reveal in Finder for a saved user-selected file"
  "replaceItemAt :: atomic final replacement from a sibling temp file"
  "startAccessingSecurityScopedResource :: current-session scoped file access around selected URLs"
  "stopAccessingSecurityScopedResource :: balanced release of scoped file access"
  "createFile :: sibling temp-file staging and placeholder creation before replaceItemAt"
  "removeItem :: cleanup for failed temp-file or placeholder writes"
)
WATCHED_NATIVE_API_PATTERN='FileManager|NSOpenPanel|NSSavePanel|NSWorkspace|FileHandle|replaceItemAt|replaceItem\(|replacingItem|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|createFile|removeItem|moveItem|copyItem|\.write\(to:'
ALLOWED_NATIVE_API_PATTERN='FileManager|NSOpenPanel|NSSavePanel|NSWorkspace|replaceItemAt|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|createFile|removeItem'
FORBIDDEN_NATIVE_API_PATTERN='FileHandle|replaceItem\(|replacingItem|(^|[^A-Za-z0-9_])moveItem[[:space:]]*\(|(^|[^A-Za-z0-9_])copyItem[[:space:]]*\(|\.write\(to:'

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

shopt -s nullglob
persistence_swift_sources=($PERSISTENCE_SWIFT_SOURCE_GLOB)
shopt -u nullglob

if ((${#persistence_swift_sources[@]} == 0)); then
  fail "native API allowlist scan found no Swift sources for scope: $PERSISTENCE_SWIFT_SOURCE_GLOB"
fi

printf 'Native file API allowlist:\n'
for entry in "${NATIVE_API_ALLOWLIST[@]}"; do
  printf '  - %s\n' "$entry"
done

while IFS= read -r match; do
  [[ -n "$match" ]] || continue
  fail "unexpected native file API outside allowlist: $match"
done < <(grep -nE "$FORBIDDEN_NATIVE_API_PATTERN" "${persistence_swift_sources[@]}" || true)

while IFS= read -r match; do
  [[ -n "$match" ]] || continue

  if ! printf '%s\n' "$match" | grep -Eq "$ALLOWED_NATIVE_API_PATTERN"; then
    fail "unexpected native file API outside allowlist: $match"
  fi
done < <(grep -nE "$WATCHED_NATIVE_API_PATTERN" "${persistence_swift_sources[@]}" || true)

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
