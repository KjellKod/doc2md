#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="Release"
ALLOW_DEVELOPMENT_LICENSE_KEY_FOR_PR=0
REQUIRE_POLAR_ORGANIZATION_ID=0
POLAR_SANDBOX=0
PERSISTENCE_SWIFT_SOURCE_ROOT="apps/macos/doc2md"
NOTICE_SOURCE_PATH="apps/macos/THIRD_PARTY_NOTICES.md"
NOTICE_STAGE_DIR=""
NOTICE_BACKUP_PATH=""
NOTICE_STAGED_PATH=""
POLAR_ORGANIZATION_ID=""
SANDBOX_APP_NAME="doc2md Sandbox (Non-Production)"
NATIVE_API_ALLOWLIST=(
  "FileManager :: stat/read/temp-file creation/atomic replacement staging for user-selected Markdown files"
  "NSOpenPanel :: user-selected supported-document open panel"
  "NSSavePanel :: user-selected Markdown Save As target panel"
  "NSWorkspace :: Reveal in Finder for a saved user-selected file"
  "NSWorkspace :: About panel Docs and GitHub button opens of the doc2md GitHub repository"
  "replaceItemAt :: atomic final replacement from a sibling temp file"
  "moveItem :: atomic first publication of completed Document Library metadata"
  "startAccessingSecurityScopedResource :: current-session scoped file access around selected URLs"
  "stopAccessingSecurityScopedResource :: balanced release of scoped file access"
  "createFile :: sibling temp-file staging and placeholder creation before replaceItemAt"
  "removeItem :: cleanup for failed temp-file, placeholder writes, or disabled Application Support settings"
  "Application Support settings :: metadata-only settings-file read/write/delete/atomic replacement"
  "Application Support license token :: license-token file read/write/delete under doc2md Application Support"
  "Application Support Polar license metadata :: non-secret metadata read/write/delete/atomic replacement"
  "Application Support document library :: unlimited path metadata read/write/atomic replacement"
)
WATCHED_NATIVE_API_PATTERN='FileManager|NSOpenPanel|NSSavePanel|NSWorkspace|FileHandle|replaceItemAt|replaceItem\(|replacingItem|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|createFile|removeItem|moveItem|copyItem|\.write\(to:'
ALLOWED_NATIVE_API_PATTERN='FileManager|NSOpenPanel|NSSavePanel|NSWorkspace|replaceItemAt|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|createFile|removeItem'
FORBIDDEN_NATIVE_API_PATTERN='FileHandle|replaceItem\(|replacingItem|(^|[^A-Za-z0-9_])moveItem[[:space:]]*\(|(^|[^A-Za-z0-9_])copyItem[[:space:]]*\(|\.write\(to:'

usage() {
  printf 'Usage: %s [--configuration Debug|Release] [--require-polar-organization-id] [--polar-sandbox] [--allow-development-license-key-for-pr]\n' "$(basename "$0")"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

restore_staged_notices() {
  local status=$?

  if [[ -n "$NOTICE_BACKUP_PATH" && -f "$NOTICE_BACKUP_PATH" ]]; then
    cp "$NOTICE_BACKUP_PATH" "$NOTICE_SOURCE_PATH" || status=$?
  fi

  if [[ -n "$NOTICE_STAGE_DIR" && -d "$NOTICE_STAGE_DIR" ]]; then
    rm -rf "$NOTICE_STAGE_DIR" || status=$?
  fi

  return "$status"
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
  local source_path=""
  local line_number=""
  local source_content=""

  if printf '%s\n' "$match" | grep -Eq "$ALLOWED_NATIVE_API_PATTERN"; then
    return 0
  fi

  case "$match" in
    apps/macos/doc2md/Licensing/ApplicationSupportLicenseStore.swift:*'Data((token + "\n").utf8).write(to: tokenURL, options: [.atomic])'*)
      return 0
      ;;
  esac

  IFS=: read -r source_path line_number source_content <<< "$match"
  if [[ "$source_path" == "apps/macos/doc2md/DocumentLibraryStore.swift" &&
        "$line_number" =~ ^[0-9]+$ &&
        "$source_content" == '                    try fileManager.moveItem(at: tempURL, to: storeURL)' ]]; then
    return 0
  fi

  if [[ "$source_path" == "apps/macos/doc2md/Licensing/PolarLicensePersistence.swift" &&
        "$line_number" =~ ^[0-9]+$ &&
        "$source_content" == '        try encoded.write(to: metadataURL, options: [.atomic])' ]]; then
    return 0
  fi

  return 1
}

validated_polar_organization_id() {
  local value="$1"

  if [[ "$value" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$ ]]; then
    printf '%s' "$value"
    return 0
  fi

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

sanitize_xcodebuild_output() {
  if [[ -n "$POLAR_ORGANIZATION_ID" ]]; then
    sed \
      -e "s/$POLAR_ORGANIZATION_ID/[public organization ID]/g" \
      -e "s/^\\*\\* BUILD SUCCEEDED \\*\\*$/** $BUILD_VERSION BUILD SUCCEEDED **/"
    return
  fi
  sed "s/^\\*\\* BUILD SUCCEEDED \\*\\*$/** $BUILD_VERSION BUILD SUCCEEDED **/"
}

bundle_version_for() {
  node --input-type=module -e "import { deriveBundleVersion } from './packages/core/scripts/release-version.mjs'; console.log(deriveBundleVersion(process.argv[1]));" "$1"
}

prepare_notice_resource() {
  if [[ "${DOC2MD_RELEASE_REF+x}" != "x" ]]; then
    npm run generate:notices
    return
  fi

  NOTICE_STAGE_DIR="$(mktemp -d)"
  NOTICE_BACKUP_PATH="$NOTICE_STAGE_DIR/THIRD_PARTY_NOTICES.md.default"
  NOTICE_STAGED_PATH="$NOTICE_STAGE_DIR/THIRD_PARTY_NOTICES.md.release"

  cp "$NOTICE_SOURCE_PATH" "$NOTICE_BACKUP_PATH"
  trap restore_staged_notices EXIT

  npm run generate:notices -- --output "$NOTICE_STAGED_PATH"
  cp "$NOTICE_STAGED_PATH" "$NOTICE_SOURCE_PATH"
}

prepare_debug_web_resource() {
  if [[ "$CONFIGURATION" != "Debug" ]]; then
    return 0
  fi

  local resource_dir="apps/macos/doc2md/Resources/Web"
  mkdir -p "$resource_dir"
  find "$resource_dir" -mindepth 1 ! -name '.gitkeep' -delete
  ditto dist "$resource_dir"
  touch "$resource_dir/.gitkeep"
}

verify_notice_resource_restored() {
  if [[ -z "$NOTICE_BACKUP_PATH" ]]; then
    return
  fi

  cp "$NOTICE_BACKUP_PATH" "$NOTICE_SOURCE_PATH"
  cmp "$NOTICE_BACKUP_PATH" "$NOTICE_SOURCE_PATH" >/dev/null
  git diff --exit-code -- "$NOTICE_SOURCE_PATH" >/dev/null
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
    --require-polar-organization-id)
      REQUIRE_POLAR_ORGANIZATION_ID=1
      shift
      ;;
    --polar-sandbox)
      POLAR_SANDBOX=1
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

PRODUCTION_POLAR_ORGANIZATION_ID="${DOC2MD_POLAR_ORGANIZATION_ID:-}"
SANDBOX_POLAR_ORGANIZATION_ID="${DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID:-}"

if ((POLAR_SANDBOX)); then
  [[ "$CONFIGURATION" == "Debug" ]] || fail "--polar-sandbox requires Debug configuration"
  ((REQUIRE_POLAR_ORGANIZATION_ID == 0)) || fail "--require-polar-organization-id cannot be combined with --polar-sandbox"
  [[ -z "$PRODUCTION_POLAR_ORGANIZATION_ID" ]] || fail "DOC2MD_POLAR_ORGANIZATION_ID cannot be set for a sandbox build"
  [[ -n "$SANDBOX_POLAR_ORGANIZATION_ID" ]] || fail "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID is required for a sandbox build"
  if ! POLAR_ORGANIZATION_ID="$(validated_polar_organization_id "$SANDBOX_POLAR_ORGANIZATION_ID")"; then
    fail "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID must be a UUID in 8-4-4-4-12 form"
  fi
else
  [[ -z "$SANDBOX_POLAR_ORGANIZATION_ID" ]] || fail "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID requires --polar-sandbox"
  if [[ "${OTHER_SWIFT_FLAGS:-}" == *DOC2MD_POLAR_SANDBOX* ||
        "${SWIFT_ACTIVE_COMPILATION_CONDITIONS:-}" == *DOC2MD_POLAR_SANDBOX* ]]; then
    fail "$CONFIGURATION builds cannot use DOC2MD_POLAR_SANDBOX without --polar-sandbox"
  fi
  if [[ -n "$PRODUCTION_POLAR_ORGANIZATION_ID" ]]; then
    if ! POLAR_ORGANIZATION_ID="$(validated_polar_organization_id "$PRODUCTION_POLAR_ORGANIZATION_ID")"; then
      fail "DOC2MD_POLAR_ORGANIZATION_ID must be a UUID in 8-4-4-4-12 form"
    fi
  elif ((REQUIRE_POLAR_ORGANIZATION_ID)); then
    fail "DOC2MD_POLAR_ORGANIZATION_ID is required for this build"
  fi
fi

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
MARKETING_VERSION_OVERRIDE="${BUILD_VERSION%-dev}"
BUNDLE_VERSION_OVERRIDE="$(bundle_version_for "$MARKETING_VERSION_OVERRIDE")"

node scripts/generate-release-commit.mjs
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

prepare_notice_resource
npm run build:desktop
prepare_debug_web_resource

XCODE_BUILD_SETTINGS=(
  "MARKETING_VERSION=$MARKETING_VERSION_OVERRIDE"
  "CURRENT_PROJECT_VERSION=$BUNDLE_VERSION_OVERRIDE"
  "DOC2MD_POLAR_ORGANIZATION_ID=$POLAR_ORGANIZATION_ID"
)

if ((POLAR_SANDBOX)); then
  XCODE_BUILD_SETTINGS+=(
    'OTHER_SWIFT_FLAGS=$(inherited) -DDOC2MD_POLAR_SANDBOX'
    "PRODUCT_BUNDLE_IDENTIFIER=com.kjellkod.doc2md.sandbox"
    "DOC2MD_BUNDLE_DISPLAY_NAME=$SANDBOX_APP_NAME"
    "DOC2MD_BUNDLE_NAME=$SANDBOX_APP_NAME"
  )
fi

if [[ "$CONFIGURATION" = "Debug" ]]; then
  XCODE_BUILD_SETTINGS+=("ENABLE_DEBUG_DYLIB=NO")
fi

set +e
"$XCODEBUILD_BIN" \
  -project apps/macos/doc2md.xcodeproj \
  -scheme doc2md \
  -configuration "$CONFIGURATION" \
  -derivedDataPath .build/mac \
  "${XCODE_BUILD_SETTINGS[@]}" \
  build 2>&1 | sanitize_xcodebuild_output
pipeline_status=("${PIPESTATUS[@]}")
set -e

if ((pipeline_status[0] != 0)); then
  exit "${pipeline_status[0]}"
fi

if ((pipeline_status[1] != 0)); then
  fail "failed to rewrite xcodebuild success output"
fi

verify_notice_resource_restored

APP_PATH="$REPO_ROOT/.build/mac/Build/Products/$CONFIGURATION/doc2md.app"
if [[ ! -d "$APP_PATH" ]]; then
  fail "xcodebuild completed, but expected app was not found: $APP_PATH"
fi

INFO_PLIST="$APP_PATH/Contents/Info.plist"
[[ -f "$INFO_PLIST" ]] || fail "built Info.plist was not found: $INFO_PLIST"

set +e
BUILT_POLAR_ORGANIZATION_ID="$(/usr/libexec/PlistBuddy -c 'Print :DOC2MDPolarOrganizationID' "$INFO_PLIST" 2>/dev/null)"
BUILT_POLAR_ORGANIZATION_ID_STATUS=$?
set -e

if ((BUILT_POLAR_ORGANIZATION_ID_STATUS != 0)); then
  fail "built Info.plist is missing DOC2MDPolarOrganizationID"
fi

if [[ "$BUILT_POLAR_ORGANIZATION_ID" != "$POLAR_ORGANIZATION_ID" ]]; then
  fail "built Info.plist Polar organization ID does not match the validated build value"
fi

BUILT_DISPLAY_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "$INFO_PLIST")"
BUILT_BUNDLE_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$INFO_PLIST")"
BUILT_BUNDLE_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$INFO_PLIST")"

if ((POLAR_SANDBOX)); then
  [[ "$BUILT_DISPLAY_NAME" == "$SANDBOX_APP_NAME" ]] || fail "sandbox Info.plist is missing its non-production display name"
  [[ "$BUILT_BUNDLE_NAME" == "$SANDBOX_APP_NAME" ]] || fail "sandbox Info.plist is missing its non-production bundle name"
  [[ "$BUILT_BUNDLE_IDENTIFIER" == "com.kjellkod.doc2md.sandbox" ]] || fail "sandbox Info.plist has the wrong bundle identifier"
else
  [[ "$BUILT_DISPLAY_NAME" == "doc2md" ]] || fail "production Info.plist has the wrong display name"
  [[ "$BUILT_BUNDLE_NAME" == "doc2md" ]] || fail "production Info.plist has the wrong bundle name"
  [[ "$BUILT_BUNDLE_IDENTIFIER" == "com.kjellkod.doc2md" ]] || fail "production Info.plist has the wrong bundle identifier"
fi

printf 'Built: %s\n' "$(absolute_path "$APP_PATH")"
printf 'Default npm shortcut: npm run build:mac\n'
