#!/usr/bin/env bash
# scripts/release/release_mac_local.sh
#
# Run the full Mac release pipeline locally on a maintainer machine.
# Same end result as the protected mac-release GitHub workflow:
#
#   1. Build Release app                  (npm run build:mac)
#   2. Sign app with Developer ID         (codesign, local Keychain)
#   3. Notarize + staple app              (scripts/release/notarize_mac_app.sh)
#   4. Package polished DMG               (scripts/release/package_mac_dmg.sh)
#   5. Sign DMG with Developer ID         (inside package_mac_dmg.sh, release mode)
#   6. Notarize + staple + validate DMG   (scripts/release/notarize_mac_dmg.sh)
#
# Required environment variables (script lists missing ones with hints):
#   CODESIGN_IDENTITY              "Developer ID Application: Your Name (TEAMID)"
#                                  Cert must already be in your login Keychain.
#   APPLE_NOTARY_API_KEY_PATH      Path to App Store Connect .p8 key file.
#   APPLE_NOTARY_API_KEY_ID        10-char Key ID from App Store Connect.
#   APPLE_NOTARY_API_ISSUER_ID     UUID issuer ID from App Store Connect.
#
# Optional:
#   VERSION    Release version (e.g. 2.3.0). Derived from Info.plist if unset.
#
# Output: .build/release/doc2md-<VERSION>.dmg, fully signed/notarized/stapled.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && /bin/pwd)"
cd "$REPO_ROOT"

note() {
  printf '\033[1;34m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"
}

fail() {
  printf '\033[1;31mError:\033[0m %s\n' "$*" >&2
  exit 1
}

print_missing_env_help() {
  local var="$1"
  case "$var" in
    CODESIGN_IDENTITY)
      cat >&2 <<'EOF'

  CODESIGN_IDENTITY
    The Developer ID Application identity string from your local Keychain.
    The cert must already be imported into your login Keychain.

    Find your identity:
      security find-identity -v -p codesigning | grep "Developer ID Application"

    Example:
      export CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
EOF
      ;;
    APPLE_NOTARY_API_KEY_PATH)
      cat >&2 <<'EOF'

  APPLE_NOTARY_API_KEY_PATH
    Path to your App Store Connect API .p8 key file.

    Get it from: https://appstoreconnect.apple.com/access/api
    Click "+" to create a key (only "Developer" role needed). The .p8 file
    can only be downloaded once; save it somewhere durable like ~/.private_keys/.

    Example:
      export APPLE_NOTARY_API_KEY_PATH="$HOME/.private_keys/AuthKey_ABC1234567.p8"
EOF
      ;;
    APPLE_NOTARY_API_KEY_ID)
      cat >&2 <<'EOF'

  APPLE_NOTARY_API_KEY_ID
    The 10-character Key ID shown next to the .p8 key in App Store Connect.

    Example:
      export APPLE_NOTARY_API_KEY_ID="ABC1234567"
EOF
      ;;
    APPLE_NOTARY_API_ISSUER_ID)
      cat >&2 <<'EOF'

  APPLE_NOTARY_API_ISSUER_ID
    The Issuer ID UUID for your App Store Connect team.

    Found at the top of: https://appstoreconnect.apple.com/access/api

    Example:
      export APPLE_NOTARY_API_ISSUER_ID="00000000-0000-0000-0000-000000000000"
EOF
      ;;
  esac
}

REQUIRED_ENV=(
  CODESIGN_IDENTITY
  APPLE_NOTARY_API_KEY_PATH
  APPLE_NOTARY_API_KEY_ID
  APPLE_NOTARY_API_ISSUER_ID
)

missing=()
for var in "${REQUIRED_ENV[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf '\033[1;31mMissing required environment variables:\033[0m\n' >&2
  for var in "${missing[@]}"; do
    print_missing_env_help "$var"
  done
  printf '\nSet the missing variables and re-run.\n' >&2
  exit 1
fi

[[ -f "$APPLE_NOTARY_API_KEY_PATH" ]] \
  || fail "APPLE_NOTARY_API_KEY_PATH does not point to a file: $APPLE_NOTARY_API_KEY_PATH"

if [[ -z "${VERSION:-}" ]]; then
  INFO_PLIST="apps/macos/doc2md/Info.plist"
  [[ -f "$INFO_PLIST" ]] || fail "VERSION not set and $INFO_PLIST is missing"
  VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INFO_PLIST")"
  [[ -n "$VERSION" ]] || fail "could not derive VERSION from $INFO_PLIST"
  note "VERSION=$VERSION (derived from Info.plist)"
  export VERSION
fi

note "Verifying CODESIGN_IDENTITY exists in Keychain"
if ! security find-identity -v -p codesigning | grep -F "$CODESIGN_IDENTITY" >/dev/null; then
  fail "CODESIGN_IDENTITY not found in any keychain: $CODESIGN_IDENTITY
Run 'security find-identity -v -p codesigning | grep \"Developer ID Application\"' and
re-export CODESIGN_IDENTITY with the exact string shown."
fi

# ---------------------------------------------------------------------------
# 1. Build Release app
# ---------------------------------------------------------------------------
note "1/6 Building Release Mac app"
npm run build:mac

APP_PATH=".build/mac/Build/Products/Release/doc2md.app"
[[ -d "$APP_PATH" ]] || fail "expected app bundle is missing: $APP_PATH"

# ---------------------------------------------------------------------------
# 2. Sign app with Developer ID Application
# ---------------------------------------------------------------------------
note "2/6 Signing app with $CODESIGN_IDENTITY"
codesign --force \
  --options runtime \
  --timestamp \
  --sign "$CODESIGN_IDENTITY" \
  --preserve-metadata=entitlements \
  "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

# ---------------------------------------------------------------------------
# 3. Notarize + staple app
#    notarize_mac_app.sh expects APPLE_NOTARY_API_KEY_P8 as the file CONTENTS.
#    We read the .p8 once into the env for the subprocess, never persisting.
# ---------------------------------------------------------------------------
note "3/6 Notarizing + stapling app (this can take 1-3 minutes)"
APP_PATH="$APP_PATH" \
  APPLE_NOTARY_API_KEY_P8="$(cat "$APPLE_NOTARY_API_KEY_PATH")" \
  APPLE_NOTARY_API_KEY_ID="$APPLE_NOTARY_API_KEY_ID" \
  APPLE_NOTARY_API_ISSUER_ID="$APPLE_NOTARY_API_ISSUER_ID" \
  ./scripts/release/notarize_mac_app.sh

# ---------------------------------------------------------------------------
# 4 & 5. Package polished DMG; release mode also signs the DMG.
# ---------------------------------------------------------------------------
note "4-5/6 Packaging polished DMG and signing"
APP_PATH="$APP_PATH" \
  VERSION="$VERSION" \
  CODESIGN_IDENTITY="$CODESIGN_IDENTITY" \
  ./scripts/release/package_mac_dmg.sh

DMG_PATH=".build/release/doc2md-${VERSION}.dmg"
[[ -f "$DMG_PATH" ]] || fail "expected DMG is missing: $DMG_PATH"

# ---------------------------------------------------------------------------
# 6. Notarize + staple + validate DMG
# ---------------------------------------------------------------------------
note "6/6 Notarizing + stapling + validating DMG (this can take 1-3 minutes)"
DMG_PATH="$DMG_PATH" \
  VERSION="$VERSION" \
  APPLE_NOTARY_API_KEY_P8="$(cat "$APPLE_NOTARY_API_KEY_PATH")" \
  APPLE_NOTARY_API_KEY_ID="$APPLE_NOTARY_API_KEY_ID" \
  APPLE_NOTARY_API_ISSUER_ID="$APPLE_NOTARY_API_ISSUER_ID" \
  ./scripts/release/notarize_mac_dmg.sh

# ---------------------------------------------------------------------------
# Done — print final validation commands the user can re-run on a clean Mac
# ---------------------------------------------------------------------------
printf '\n'
note "Done. Signed/notarized/stapled DMG ready at:"
printf '       \033[1;32m%s\033[0m\n\n' "$DMG_PATH"
note "Re-validate any time with:"
printf '       codesign --verify --strict --verbose=2 \033[1m%s\033[0m\n' "$DMG_PATH"
printf '       xcrun stapler validate \033[1m%s\033[0m\n' "$DMG_PATH"
printf '       spctl --assess --type open --context context:primary-signature --verbose=4 \033[1m%s\033[0m\n' "$DMG_PATH"
