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
#   VERSION    Release version (e.g. 2.3.0). Derived from git state if unset:
#              - clean tree at the latest X.Y.Z tag: VERSION=<that tag>
#              - anything else (commits past tag or dirty tracked files):
#                VERSION=X.Y.(Z+1)-dev, so a local build can never be confused
#                with the official release artifact of the same number.
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
  # The source Info.plist holds Xcode build-setting placeholders
  # (CFBundleShortVersionString = "$(MARKETING_VERSION)"), so reading it
  # pre-build returns the literal placeholder string, not the version.
  # Derive from git state instead — see header comment for policy.
  latest_tag="$(git tag --list '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n 1)"
  [[ -n "$latest_tag" ]] \
    || fail "no X.Y.Z release tag found; export VERSION manually or run 'git fetch --tags'"

  head_sha="$(git rev-parse HEAD)"
  tag_sha="$(git rev-parse "${latest_tag}^{commit}")"

  dirty="false"
  if ! git diff --quiet HEAD --; then
    dirty="true"
  fi

  if [[ "$head_sha" == "$tag_sha" && "$dirty" == "false" ]]; then
    VERSION="$latest_tag"
    note "VERSION=$VERSION (clean tree at release tag $latest_tag)"
  else
    IFS=. read -r _maj _min _pat <<<"$latest_tag"
    VERSION="${_maj}.${_min}.$((_pat + 1))-dev"
    if [[ "$head_sha" == "$tag_sha" ]]; then
      reason="HEAD on $latest_tag but tracked working-tree changes present"
    elif [[ "$dirty" == "true" ]]; then
      reason="HEAD past $latest_tag and tracked working-tree changes present"
    else
      reason="HEAD past $latest_tag"
    fi
    note "VERSION=$VERSION ($reason)"
  fi
  export VERSION
fi

note "Verifying CODESIGN_IDENTITY exists in Keychain"
identities=""
if ! identities="$(security find-identity -v -p codesigning 2>&1)"; then
  fail "security find-identity failed (exit $?). Is the login Keychain unlocked? Output:
$identities"
fi
# Bash substring match — no grep, no pipe — distinguishes "tool failed" (above)
# from "identity not found" (below) instead of collapsing both into one
# misleading error. See PR #112 review.
if [[ "$identities" != *"$CODESIGN_IDENTITY"* ]]; then
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
#
# Match the CI signer's flags (scripts/release/sign_mac_app.sh): --deep so the
# bundled Sparkle.framework helpers (Updater.app, Autoupdate, XPCServices) are
# all re-signed under the same Developer ID, --options runtime for hardened
# runtime, --timestamp for secure-timestamped signatures Apple notarization
# requires. Do not use --preserve-metadata=entitlements here; that flag
# suppresses --deep recursion and leaves embedded helpers with their original
# (Xcode debug) signatures, which makes "codesign --verify --deep" report
# "a sealed resource is missing or invalid".
# ---------------------------------------------------------------------------
note "2/6 Signing app with $CODESIGN_IDENTITY"
codesign --force \
  --deep \
  --options runtime \
  --timestamp \
  --sign "$CODESIGN_IDENTITY" \
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
# Final validation + summary
# ---------------------------------------------------------------------------
note "Running final validation on $DMG_PATH"

run_final_check() {
  local label="$1"
  shift
  local output
  local status=0
  output="$("$@" 2>&1)" || status=$?
  if [[ "$status" -eq 0 ]]; then
    printf '  \033[1;32m[PASS]\033[0m %s\n' "$label"
  else
    printf '  \033[1;31m[FAIL]\033[0m %s (exit %s)\n' "$label" "$status"
    # `|| true` prevents set -o pipefail from converting head's SIGPIPE
    # close into a non-zero pipeline status that set -e would honor and
    # abort the script during failure-report formatting.
    printf '%s\n' "$output" | head -n 5 | sed 's/^/         /' || true
  fi
  return "$status"
}

OVERALL_STATUS=0
run_final_check "codesign --verify --strict" \
  codesign --verify --strict --verbose=2 "$DMG_PATH" || OVERALL_STATUS=1
run_final_check "xcrun stapler validate" \
  xcrun stapler validate "$DMG_PATH" || OVERALL_STATUS=1
run_final_check "spctl --assess (Gatekeeper)" \
  spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH" || OVERALL_STATUS=1

DMG_SIZE_BYTES="$(stat -f '%z' "$DMG_PATH")"
DMG_SIZE_MB="$(awk "BEGIN { printf \"%.1f\", $DMG_SIZE_BYTES / 1048576 }")"

printf '\n'
printf '\033[1m═══════════════════════════════════════════════════════════════\033[0m\n'
if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  printf '\033[1;32m  PASSED\033[0m  Local signed Mac release pipeline\n'
else
  printf '\033[1;31m  FAILED\033[0m  Local signed Mac release pipeline (validation errors above)\n'
fi
printf '\033[1m═══════════════════════════════════════════════════════════════\033[0m\n\n'
printf '  Version:      %s\n' "$VERSION"
printf '  Identity:     %s\n' "$CODESIGN_IDENTITY"
printf '  App bundle:   %s\n' "$APP_PATH"
printf '  DMG path:     \033[1m%s\033[0m\n' "$DMG_PATH"
printf '  DMG size:     %s MB (%s bytes)\n' "$DMG_SIZE_MB" "$DMG_SIZE_BYTES"
printf '\n'
printf '  Pipeline steps completed:\n'
printf '    [ok] 1. Build Release Mac app\n'
printf '    [ok] 2. Sign app with Developer ID Application\n'
printf '    [ok] 3. Notarize + staple app\n'
printf '    [ok] 4. Package polished DMG (mount self-test passed)\n'
printf '    [ok] 5. Sign DMG with Developer ID Application\n'
printf '    [ok] 6. Notarize + staple + validate DMG\n'
printf '\n'
if [[ "$OVERALL_STATUS" -eq 0 ]]; then
  printf '  Re-validate any time with:\n'
  printf '    codesign --verify --strict --verbose=2 \033[1m%s\033[0m\n' "$DMG_PATH"
  printf '    xcrun stapler validate \033[1m%s\033[0m\n' "$DMG_PATH"
  printf '    spctl --assess --type open --context context:primary-signature --verbose=4 \033[1m%s\033[0m\n' "$DMG_PATH"
  printf '\n'
  printf '  Next: copy the DMG to a clean Mac, drag-install, and confirm Gatekeeper\n'
  printf '  accepts it without an "unidentified developer" prompt.\n'
  printf '\n'
  printf '  \033[1mPer the doc2md Desktop Shareware License, do not distribute or publish\033[0m\n'
  printf '  \033[1mlocally-built signed artifacts; the protected release-mac workflow\033[0m\n'
  printf '  \033[1mproduces the approved public artifact.\033[0m\n'
else
  printf '  See validation errors above. Common causes:\n'
  printf '    - codesign --verify failure: re-sign with --deep, or the cert chain\n'
  printf '      changed and the DMG needs a fresh build.\n'
  printf '    - stapler validate failure: notarization staple did not attach;\n'
  printf '      check notarytool log for the submission ID.\n'
  printf '    - spctl assess failure: macOS runner version may have changed how\n'
  printf '      Gatekeeper inspects the DMG; verify codesign + stapler still pass.\n'
fi
printf '\n'

exit "$OVERALL_STATUS"
