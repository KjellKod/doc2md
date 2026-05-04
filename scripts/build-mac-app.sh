#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="Release"
ALLOW_DEVELOPMENT_LICENSE_KEY_FOR_PR=0
PERSISTENCE_SWIFT_SOURCE_ROOT="apps/macos/doc2md"
NATIVE_API_ALLOWLIST=(
  "FileManager :: stat/read/temp-file creation/atomic replacement staging for user-selected Markdown files"
  "NSOpenPanel :: user-selected supported-document open panel"
  "NSSavePanel :: user-selected Markdown Save As target panel"
  "NSWorkspace :: Reveal in Finder for a saved user-selected file"
  "NSWorkspace :: Help menu open of bundled THIRD_PARTY_NOTICES.md and LicenseRef-doc2md-Desktop.txt"
  "replaceItemAt :: atomic final replacement from a sibling temp file"
  "startAccessingSecurityScopedResource :: current-session scoped file access around selected URLs"
  "stopAccessingSecurityScopedResource :: balanced release of scoped file access"
  "createFile :: sibling temp-file staging and placeholder creation before replaceItemAt"
  "removeItem :: cleanup for failed temp-file, placeholder writes, or disabled Application Support settings"
  "Application Support settings :: metadata-only settings-file read/write/delete/atomic replacement"
  "Application Support license token :: license-token file read/write/delete under doc2md Application Support"
)
WATCHED_NATIVE_API_PATTERN='FileManager|NSOpenPanel|NSSavePanel|NSWorkspace|FileHandle|replaceItemAt|replaceItem\(|replacingItem|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|createFile|removeItem|moveItem|copyItem|\.write\(to:'
ALLOWED_NATIVE_API_PATTERN='FileManager|NSOpenPanel|NSSavePanel|NSWorkspace|replaceItemAt|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|createFile|removeItem'
FORBIDDEN_NATIVE_API_PATTERN='FileHandle|replaceItem\(|replacingItem|(^|[^A-Za-z0-9_])moveItem[[:space:]]*\(|(^|[^A-Za-z0-9_])copyItem[[:space:]]*\(|\.write\(to:'

usage() {
  printf 'Usage: %s [--configuration Debug|Release] [--allow-development-license-key-for-pr]\n' "$(basename "$0")"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

grep_matches_or_fail() {
  local pattern="$1"
  shift

  local output=""
  local status=0

  set +e
  output=$(grep -nE "$pattern" "$@" 2>&1)
  status=$?
  set -e

  case "$status" in
    0|1) ;;
    *)
      fail "native API allowlist scan failed with grep status $status: $output"
      ;;
  esac

  printf '%s\n' "$output"
}

collect_persistence_swift_sources() {
  local source_root="$1"

  [[ -d "$source_root" ]] || fail "native API allowlist scan source root not found: $source_root"

  while IFS= read -r -d '' source_file; do
    persistence_swift_sources+=("$source_file")
  done < <(find "$source_root" -type f -name '*.swift' -print0 | sort -z)
}

is_allowed_native_api_match() {
  local match="$1"

  if printf '%s\n' "$match" | grep -Eq "$ALLOWED_NATIVE_API_PATTERN"; then
    return 0
  fi

  case "$match" in
    apps/macos/doc2md/Licensing/ApplicationSupportLicenseStore.swift:*'Data((token + "\n").utf8).write(to: tokenURL, options: [.atomic])'*)
      return 0
      ;;
  esac

  return 1
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

display_build_version() {
  node --input-type=module -e "import { getDisplayVersionInfo } from './packages/core/scripts/release-version.mjs'; console.log(getDisplayVersionInfo().version);"
}

verify_release_license_public_key() {
  local source_file="apps/macos/doc2md/Licensing/LicensePublicKeys.swift"

  [[ -f "$source_file" ]] || fail "license public key source not found: $source_file"

  if grep -q 'isDevelopmentKey: true' "$source_file" || grep -q 'doc2md-dev-' "$source_file"; then
    fail "Release builds must embed a production license public key and non-dev key_id before distribution."
  fi
}

while (($#)); do
  case "$1" in
    --configuration)
      [[ $# -ge 2 ]] || fail "--configuration requires Debug or Release"
      CONFIGURATION="$2"
      shift 2
      ;;
    --allow-development-license-key-for-pr)
      ALLOW_DEVELOPMENT_LICENSE_KEY_FOR_PR=1
      shift
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

BUILD_VERSION="$(display_build_version)"

node scripts/generate-supported-formats.mjs --check

if [[ "$CONFIGURATION" = "Release" && "$ALLOW_DEVELOPMENT_LICENSE_KEY_FOR_PR" != "1" ]]; then
  verify_release_license_public_key
elif [[ "$CONFIGURATION" = "Release" ]]; then
  printf 'Warning: allowing development license public key for PR-only Release compile. Distribution builds must not use this flag.\n' >&2
fi

persistence_swift_sources=()
collect_persistence_swift_sources "$PERSISTENCE_SWIFT_SOURCE_ROOT"

if ((${#persistence_swift_sources[@]} == 0)); then
  fail "native API allowlist scan found no Swift sources under: $PERSISTENCE_SWIFT_SOURCE_ROOT"
fi

printf 'Native file API allowlist:\n'
for entry in "${NATIVE_API_ALLOWLIST[@]}"; do
  printf '  - %s\n' "$entry"
done

while IFS= read -r match; do
  [[ -n "$match" ]] || continue

  if ! is_allowed_native_api_match "$match"; then
    fail "unexpected native file API outside allowlist: $match"
  fi
done < <(grep_matches_or_fail "$FORBIDDEN_NATIVE_API_PATTERN" "${persistence_swift_sources[@]}")

while IFS= read -r match; do
  [[ -n "$match" ]] || continue

  if ! is_allowed_native_api_match "$match"; then
    fail "unexpected native file API outside allowlist: $match"
  fi
done < <(grep_matches_or_fail "$WATCHED_NATIVE_API_PATTERN" "${persistence_swift_sources[@]}")

npm run generate:notices
npm run build:desktop

set +e
"$XCODEBUILD_BIN" \
  -project apps/macos/doc2md.xcodeproj \
  -scheme doc2md \
  -configuration "$CONFIGURATION" \
  -derivedDataPath .build/mac \
  build 2>&1 | sed "s/^\\*\\* BUILD SUCCEEDED \\*\\*$/** $BUILD_VERSION BUILD SUCCEEDED **/"
pipeline_status=("${PIPESTATUS[@]}")
set -e

if ((pipeline_status[0] != 0)); then
  exit "${pipeline_status[0]}"
fi

if ((pipeline_status[1] != 0)); then
  fail "failed to rewrite xcodebuild success output"
fi

APP_PATH="$REPO_ROOT/.build/mac/Build/Products/$CONFIGURATION/doc2md.app"
if [[ ! -d "$APP_PATH" ]]; then
  fail "xcodebuild completed, but expected app was not found: $APP_PATH"
fi

printf 'Built: %s\n' "$(absolute_path "$APP_PATH")"
printf 'Default npm shortcut: npm run build:mac\n'
