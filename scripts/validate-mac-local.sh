#!/usr/bin/env bash
set -euo pipefail

WAIT_SECONDS="3"
SIGNED=1
TEMP_ROOT=""

usage() {
  cat <<'USAGE'
Usage: validate-mac-local.sh [--signed|--unsigned-only] [--wait-seconds N]

Run the local Mac validation suite that replaces PR-time macOS CI:
  1. Build and launch-smoke the Release .app.
  2. Build and mount-test an unsigned local DMG.
  3. Run the DMG determinism check.
  4. Build a Sparkle ZIP and generate a dry-run appcast.
  5. By default, run the signed/notarized local release path and real Sparkle
     ZIP/appcast signing.

Default mode is --signed and fails loudly if local Apple/Sparkle credentials
are missing. Use --unsigned-only only when credentials are intentionally
unavailable, for example on a contributor machine.

Required for --signed:
  CODESIGN_IDENTITY
  APPLE_NOTARY_API_KEY_PATH or APPLE_NOTARY_API_KEY_P8
  APPLE_NOTARY_API_KEY_ID
  APPLE_NOTARY_API_ISSUER_ID
  SPARKLE_EDDSA_PRIVATE_KEY
USAGE
}

note() {
  printf '\033[1;34m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"
}

fail() {
  printf '\033[1;31mError:\033[0m %s\n' "$*" >&2
  exit 1
}

cleanup() {
  rm -rf "$TEMP_ROOT"
}

validate_wait_seconds() {
  local value="$1"

  case "$value" in
    ''|*[!0-9]*)
      fail "--wait-seconds must be an integer from 0 to 60"
      ;;
  esac

  if ((10#$value > 60)); then
    fail "--wait-seconds must be between 0 and 60"
  fi

  WAIT_SECONDS="$((10#$value))"
}

print_missing_env_help() {
  local var="$1"

  case "$var" in
    CODESIGN_IDENTITY)
      cat >&2 <<'EOF'

  CODESIGN_IDENTITY
    Developer ID Application identity from your local Keychain.

    Find it with:
      security find-identity -v -p codesigning | grep "Developer ID Application"

    Example:
      export CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
EOF
      ;;
    APPLE_NOTARY_API_KEY_PATH)
      cat >&2 <<'EOF'

  APPLE_NOTARY_API_KEY_PATH or APPLE_NOTARY_API_KEY_P8
    Either point at your App Store Connect .p8 key file, or provide the key
    contents in APPLE_NOTARY_API_KEY_P8.

    Example:
      export APPLE_NOTARY_API_KEY_PATH="$HOME/.private_keys/AuthKey_ABC1234567.p8"
EOF
      ;;
    APPLE_NOTARY_API_KEY_ID)
      cat >&2 <<'EOF'

  APPLE_NOTARY_API_KEY_ID
    The 10-character App Store Connect key ID.
EOF
      ;;
    APPLE_NOTARY_API_ISSUER_ID)
      cat >&2 <<'EOF'

  APPLE_NOTARY_API_ISSUER_ID
    The App Store Connect issuer UUID.
EOF
      ;;
    SPARKLE_EDDSA_PRIVATE_KEY)
      cat >&2 <<'EOF'

  SPARKLE_EDDSA_PRIVATE_KEY
    The Sparkle EdDSA private key matching the committed SUPublicEDKey.
EOF
      ;;
  esac
}

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "Mac validation requires macOS. Run this on a Mac with full Xcode installed."
}

require_dmgbuild() {
  if command -v dmgbuild >/dev/null 2>&1; then
    return
  fi

  fail "dmgbuild is required. Install it from the repo root:
  brew install pipx
  pipx install \"dmgbuild==1.6.7\" --pip-args \"--constraint \$PWD/requirements-mac-release.txt\""
}

require_signed_credentials() {
  local missing=()

  [[ -n "${CODESIGN_IDENTITY:-}" ]] || missing+=("CODESIGN_IDENTITY")
  if [[ -z "${APPLE_NOTARY_API_KEY_PATH:-}" && -z "${APPLE_NOTARY_API_KEY_P8:-}" ]]; then
    missing+=("APPLE_NOTARY_API_KEY_PATH")
  fi
  [[ -n "${APPLE_NOTARY_API_KEY_ID:-}" ]] || missing+=("APPLE_NOTARY_API_KEY_ID")
  [[ -n "${APPLE_NOTARY_API_ISSUER_ID:-}" ]] || missing+=("APPLE_NOTARY_API_ISSUER_ID")
  [[ -n "${SPARKLE_EDDSA_PRIVATE_KEY:-}" ]] || missing+=("SPARKLE_EDDSA_PRIVATE_KEY")

  if ((${#missing[@]} > 0)); then
    printf '\033[1;31mMissing local Mac signing/notarization credentials:\033[0m\n' >&2
    for var in "${missing[@]}"; do
      print_missing_env_help "$var"
    done
    printf '\nSet the missing variables and rerun, or use --unsigned-only when you intentionally want the reduced local smoke path.\n' >&2
    exit 1
  fi

  if [[ -n "${APPLE_NOTARY_API_KEY_PATH:-}" ]]; then
    [[ -f "$APPLE_NOTARY_API_KEY_PATH" ]] || fail "APPLE_NOTARY_API_KEY_PATH does not point to a file: $APPLE_NOTARY_API_KEY_PATH"
    return
  fi

  mkdir -p "$TEMP_ROOT"
  APPLE_NOTARY_API_KEY_PATH="$TEMP_ROOT/notary-key.p8"
  export APPLE_NOTARY_API_KEY_PATH
  printf '%s' "$APPLE_NOTARY_API_KEY_P8" >"$APPLE_NOTARY_API_KEY_PATH"
  chmod 600 "$APPLE_NOTARY_API_KEY_PATH"
}

display_build_version() {
  node --input-type=module -e "import { getDisplayVersionInfo } from './packages/core/scripts/release-version.mjs'; console.log(getDisplayVersionInfo().version);"
}

json_field() {
  local path="$1"
  local field="$2"

  python3 - "$path" "$field" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
print(data[sys.argv[2]])
PY
}

plist_value() {
  local plist_path="$1"
  local key="$2"

  /usr/libexec/PlistBuddy -c "Print :$key" "$plist_path"
}

generate_appcast() {
  local label="$1"
  local signature_json="$2"
  local appcast_path="$3"
  local app_path="$4"
  local version="$5"

  local info_plist="$app_path/Contents/Info.plist"
  local bundle_version
  local short_version
  local ed_signature
  local zip_bytes

  bundle_version="$(plist_value "$info_plist" "CFBundleVersion")"
  short_version="$(plist_value "$info_plist" "CFBundleShortVersionString")"
  ed_signature="$(json_field "$signature_json" "edSignature")"
  zip_bytes="$(json_field "$signature_json" "length")"

  python3 scripts/release/generate_appcast.py \
    --version "$bundle_version" \
    --short-version "$short_version" \
    --enclosure-url "https://github.com/KjellKod/doc2md/releases/download/${version}/doc2md-${version}.zip" \
    --enclosure-length "$zip_bytes" \
    --ed-signature "$ed_signature" \
    >"$appcast_path"
  xmllint --noout "$appcast_path"
  printf '%s appcast: %s\n' "$label" "$appcast_path"
}

while (($#)); do
  case "$1" in
    --signed)
      SIGNED=1
      shift
      ;;
    --unsigned-only)
      SIGNED=0
      shift
      ;;
    --wait-seconds)
      [[ $# -ge 2 ]] || fail "--wait-seconds requires a value"
      validate_wait_seconds "$2"
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && /bin/pwd)"
cd "$REPO_ROOT"

TEMP_ROOT="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-mac-validate.XXXXXX")"
trap cleanup EXIT

require_macos
require_dmgbuild
if ((SIGNED)); then
  require_signed_credentials
fi

VERSION="${VERSION:-$(display_build_version)}"
APP_PATH=".build/mac/Build/Products/Release/doc2md.app"
OUTPUT_DIR=".build/release"
DMG_PATH="$OUTPUT_DIR/doc2md-${VERSION}.dmg"
ZIP_PATH="$OUTPUT_DIR/doc2md-${VERSION}.zip"

note "1/7 Building and launch-smoking Release Mac app"
bash scripts/verify-mac-release-launch.sh --wait-seconds "$WAIT_SECONDS"
[[ -d "$APP_PATH" ]] || fail "expected app bundle is missing after launch smoke: $APP_PATH"

note "2/7 Building unsigned local DMG and running mount self-test"
RELEASE_DRY_RUN=1 VERSION="$VERSION" APP_PATH="$APP_PATH" OUTPUT_DIR="$OUTPUT_DIR" \
  bash scripts/release/package_mac_dmg.sh
[[ -f "$DMG_PATH" ]] || fail "expected unsigned DMG is missing: $DMG_PATH"

note "3/7 Checking DMG determinism"
VERSION="determinism-${VERSION}" APP_PATH="$APP_PATH" \
  bash scripts/release/check_dmg_determinism.sh

note "4/7 Building Sparkle ZIP and dry-run appcast"
VERSION="$VERSION" APP_PATH="$APP_PATH" OUTPUT_DIR="$OUTPUT_DIR" \
  bash scripts/release/package_sparkle_zip.sh
RELEASE_DRY_RUN=1 ZIP_PATH="$ZIP_PATH" OUTPUT_JSON="$OUTPUT_DIR/sparkle-signature.dry-run.json" \
  bash scripts/release/sign_sparkle_zip.sh
generate_appcast "Dry-run" "$OUTPUT_DIR/sparkle-signature.dry-run.json" "$OUTPUT_DIR/appcast.dry-run.xml" "$APP_PATH" "$VERSION"

if ((SIGNED)); then
  note "5/7 Running signed/notarized local Mac release"
  VERSION="$VERSION" bash scripts/release/release_mac_local.sh

  note "6/7 Building and signing Sparkle ZIP"
  VERSION="$VERSION" APP_PATH="$APP_PATH" OUTPUT_DIR="$OUTPUT_DIR" \
    bash scripts/release/package_sparkle_zip.sh
  ZIP_PATH="$ZIP_PATH" OUTPUT_JSON="$OUTPUT_DIR/sparkle-signature.json" \
    bash scripts/release/sign_sparkle_zip.sh

  note "7/7 Generating production-shape appcast"
  generate_appcast "Signed" "$OUTPUT_DIR/sparkle-signature.json" "$OUTPUT_DIR/appcast.xml" "$APP_PATH" "$VERSION"
else
  note "5/5 Skipping signed/notarized release validation because --unsigned-only was requested"
fi

printf '\n'
printf '\033[1;32mMac validation passed.\033[0m\n'
printf '  App:      %s\n' "$APP_PATH"
printf '  DMG:      %s\n' "$DMG_PATH"
printf '  ZIP:      %s\n' "$ZIP_PATH"
if ((SIGNED)); then
  printf '  Appcast:  %s\n' "$OUTPUT_DIR/appcast.xml"
else
  printf '  Appcast:  %s\n' "$OUTPUT_DIR/appcast.dry-run.xml"
fi
