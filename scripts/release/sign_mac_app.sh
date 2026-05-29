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

  # Strip characters a base64 secret can carry but that are never valid base64:
  # CR/LF/space line wrapping plus stray single/double quotes from a quoted
  # paste. \047 is octal for a single quote. None can corrupt a well-formed
  # secret; removing them rescues a wrapped/quoted one.
  if ! printf '%s' "$value" | tr -d '\r\n "\047' | base64 --decode >"$output_path" 2>/dev/null; then
    fail "failed to base64-decode Apple Developer ID P12 secret"
  fi

  # Fail loud, and here, if the decode produced anything other than a
  # DER-encoded PKCS#12 container. Every .p12 begins with an ASN.1 SEQUENCE
  # tag (0x30 == 48 decimal); an empty or non-p12 secret is caught now with an
  # actionable message. The byte count is a cheap, non-sensitive breadcrumb if
  # a future secret is truncated.
  local size first
  size="$(wc -c <"$output_path" | tr -d '[:space:]')"
  first="$(head -c 1 "$output_path" | od -An -tu1 | tr -d '[:space:]')"
  printf 'Decoded Developer ID P12: %s bytes, first byte %s\n' "$size" "${first:-none}" >&2
  [[ -s "$output_path" ]] \
    || fail "decoded Apple Developer ID P12 is empty; check the MACOS_CERTIFICATE secret"
  [[ "$first" == "48" ]] \
    || fail "decoded Apple Developer ID P12 is not a PKCS#12 container (first byte ${first:-none}, expected 48). Re-export with 'base64 -i cert.p12 | pbcopy' and reset the MACOS_CERTIFICATE secret"
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
  # Make the fresh keychain the default and add it to the user search list, so
  # `set-key-partition-list`, `find-identity`, and `codesign` actually look in
  # it. Without this the runner keeps searching its pre-existing login keychain
  # and reports "The specified item could not be found in the keychain" even
  # though the import succeeded. (candid_talent_edge does both; doc2md did not.)
  security default-keychain -s "$keychain_path"
  # Intentional word-splitting: each existing keychain must be a separate arg.
  # shellcheck disable=SC2046
  security list-keychains -d user -s "$keychain_path" \
    $(security list-keychains -d user | tr -d '"')
  security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$keychain_path"

  # -f pkcs12 is REQUIRED: $p12_path is a mktemp file with no .p12 extension,
  # and `security import` otherwise infers the format from the filename. With no
  # recognized extension it fails inference and reports the misleading
  # "SecKeychainItemImport: Unknown format in import" — before it ever reads the
  # password. Stating the format explicitly removes the guess. (Verified: an
  # extensionless valid p12 imports only with -f pkcs12.)
  local import_out
  if ! import_out="$(security import "$p12_path" -k "$keychain_path" -P "$APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD" -f pkcs12 -T /usr/bin/codesign -T /usr/bin/security 2>&1)"; then
    printf '%s\n' "$import_out" >&2
    fail "security import failed"
  fi
  printf '%s\n' "$import_out" >&2

  # Surface set-key-partition-list errors instead of hiding them behind >/dev/null.
  local part_out
  if ! part_out="$(security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$keychain_path" 2>&1)"; then
    printf '%s\n' "$part_out" >&2
    fail "security set-key-partition-list failed"
  fi

  APPLE_RELEASE_KEYCHAIN_PATH="$keychain_path"
  export APPLE_RELEASE_KEYCHAIN_PATH

  local identity all_identities
  all_identities="$(security find-identity -v -p codesigning "$keychain_path" 2>&1)"
  identity="$(printf '%s\n' "$all_identities" | awk -F '"' '/Developer ID Application/ { print $2; exit }')"
  if [[ -z "$identity" ]]; then
    printf 'find-identity output:\n%s\n' "$all_identities" >&2
    fail "no Developer ID Application identity found in imported P12"
  fi
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
