#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

absolute_path() {
  local path="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$path"
  else
    python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$path"
  fi
}

require_app() {
  [[ -d "$APP_PATH" ]] || fail "APP_PATH does not point to an app bundle: $APP_PATH"
}

decode_base64_secret() {
  local value="$1"
  local output_path="$2"

  # GitHub stores the secret with the line wrapping that `base64` emits by
  # default (a newline every 76 columns). BSD `base64` on the macOS runners
  # mishandles that embedded whitespace: it returns exit 0 while writing a
  # truncated/garbled file, so the error only surfaces three steps later as
  # the cryptic "security: SecKeychainItemImport: Unknown format in import."
  # Strip CR/LF/spaces first, matching the proven decode in candid_talent_edge.
  if ! printf '%s' "$value" | tr -d '\n\r ' | base64 --decode >"$output_path" 2>/dev/null; then
    fail "failed to base64-decode Apple Developer ID P12 secret"
  fi

  # Fail loud, and here, if the decode produced anything other than a
  # DER-encoded PKCS#12 container. Every .p12 begins with an ASN.1 SEQUENCE
  # tag (0x30 == 48 decimal); an empty or non-p12 secret is caught now with an
  # actionable message instead of a downstream "Unknown format" from `security`.
  [[ -s "$output_path" ]] \
    || fail "decoded Apple Developer ID P12 is empty; check the MACOS_CERTIFICATE secret"
  local magic
  magic="$(head -c 1 "$output_path" | od -An -tu1 | tr -d '[:space:]')"
  [[ "$magic" == "48" ]] \
    || fail "decoded Apple Developer ID P12 is not a PKCS#12 container (first byte ${magic:-none}, expected 48). Re-export with 'base64 -i cert.p12 | pbcopy' and reset the MACOS_CERTIFICATE secret"
}

create_keychain() {
  local p12_path="$1"
  # Default the ephemeral keychain password here rather than at top level so
  # sourcing this file (for tests) has no side effects such as spawning uuidgen.
  local KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-$(uuidgen)}"
  local keychain_path
  keychain_path="${RUNNER_TEMP:-/tmp}/doc2md-release-$$.keychain-db"

  security create-keychain -p "$KEYCHAIN_PASSWORD" "$keychain_path"
  security set-keychain-settings -lut 21600 "$keychain_path"
  security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$keychain_path"
  security import "$p12_path" -k "$keychain_path" -P "$APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$keychain_path" >/dev/null

  APPLE_RELEASE_KEYCHAIN_PATH="$keychain_path"
  export APPLE_RELEASE_KEYCHAIN_PATH

  local identity
  identity="$(security find-identity -v -p codesigning "$keychain_path" | awk -F '"' '/Developer ID Application/ { print $2; exit }')"
  [[ -n "$identity" ]] || fail "no Developer ID Application identity found in imported P12"
  CODESIGN_IDENTITY="$identity"
  export CODESIGN_IDENTITY

  if [[ -n "${GITHUB_ENV:-}" ]]; then
    {
      printf 'APPLE_RELEASE_KEYCHAIN_PATH=%s\n' "$APPLE_RELEASE_KEYCHAIN_PATH"
      printf 'CODESIGN_IDENTITY=%s\n' "$CODESIGN_IDENTITY"
    } >>"$GITHUB_ENV"
  fi

  if [[ -n "${RELEASE_ENV_FILE:-}" ]]; then
    {
      printf 'export APPLE_RELEASE_KEYCHAIN_PATH=%q\n' "$APPLE_RELEASE_KEYCHAIN_PATH"
      printf 'export CODESIGN_IDENTITY=%q\n' "$CODESIGN_IDENTITY"
    } >"$RELEASE_ENV_FILE"
  fi
}

cleanup_keychain() {
  if [[ -z "${GITHUB_ENV:-}" && -n "${APPLE_RELEASE_KEYCHAIN_PATH:-}" ]]; then
    security delete-keychain "$APPLE_RELEASE_KEYCHAIN_PATH" >/dev/null 2>&1 || true
  fi
}

# Allow tests to source this file for its functions without executing the
# signing flow (no keychain creation, no codesign). When sourced, BASH_SOURCE
# differs from $0, so we return before the imperative section below.
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  # Reachable only when sourced (e.g. tests/release/test_p12_decode.sh).
  # shellcheck disable=SC2317
  return 0 2>/dev/null || true
fi

require_app

if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
  printf 'Dry run: would sign %s with hardened runtime\n' "$(absolute_path "$APP_PATH")"
  exit 0
fi

for name in APPLE_DEVELOPER_ID_APPLICATION_P12 APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD; do
  [[ -n "${!name:-}" ]] || fail "$name is required"
done

trap cleanup_keychain EXIT

P12_PATH="$(mktemp "${RUNNER_TEMP:-/tmp}/doc2md-dev-id.XXXXXX")"
trap 'rm -f "$P12_PATH"; cleanup_keychain' EXIT
decode_base64_secret "$APPLE_DEVELOPER_ID_APPLICATION_P12" "$P12_PATH"
create_keychain "$P12_PATH"

SIGN_ARGS=(
  --force
  --deep
  --options runtime
  --timestamp
  --sign "$CODESIGN_IDENTITY"
)

if [[ -n "${ENTITLEMENTS_PATH:-}" ]]; then
  [[ -f "$ENTITLEMENTS_PATH" ]] || fail "ENTITLEMENTS_PATH does not exist: $ENTITLEMENTS_PATH"
  SIGN_ARGS+=(--entitlements "$ENTITLEMENTS_PATH")
fi

codesign "${SIGN_ARGS[@]}" "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

printf 'Signed and verified: %s\n' "$(absolute_path "$APP_PATH")"
