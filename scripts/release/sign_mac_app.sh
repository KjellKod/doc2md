#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"
KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-$(uuidgen)}"

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

  if ! printf '%s' "$value" | base64 --decode >"$output_path" 2>/dev/null; then
    fail "failed to base64-decode Apple Developer ID P12 secret"
  fi
}

create_keychain() {
  local p12_path="$1"
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
