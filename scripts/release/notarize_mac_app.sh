#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-.build/mac/Build/Products/Release/doc2md.app}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

write_notary_key() {
  local output_path="$1"

  if [[ "$APPLE_NOTARY_API_KEY_P8" == *"BEGIN PRIVATE KEY"* ]]; then
    printf '%s' "$APPLE_NOTARY_API_KEY_P8" >"$output_path"
    return
  fi

  if ! printf '%s' "$APPLE_NOTARY_API_KEY_P8" | base64 --decode >"$output_path" 2>/dev/null; then
    fail "failed to decode APPLE_NOTARY_API_KEY_P8 as raw PEM or base64 PEM"
  fi
}

[[ -d "$APP_PATH" ]] || fail "APP_PATH does not point to an app bundle: $APP_PATH"

if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
  printf 'Dry run: would notarize, staple, validate, and assess %s\n' "$APP_PATH"
  exit 0
fi

for name in APPLE_NOTARY_API_KEY_P8 APPLE_NOTARY_API_KEY_ID APPLE_NOTARY_API_ISSUER_ID; do
  [[ -n "${!name:-}" ]] || fail "$name is required"
done

WORK_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-notary.XXXXXX")"
KEY_PATH="$WORK_DIR/AuthKey_${APPLE_NOTARY_API_KEY_ID}.p8"
ZIP_PATH="$WORK_DIR/doc2md-notary.zip"
SUBMIT_JSON="$WORK_DIR/notary-submit.json"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

write_notary_key "$KEY_PATH"
chmod 600 "$KEY_PATH"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

set +e
xcrun notarytool submit "$ZIP_PATH" \
  --key "$KEY_PATH" \
  --key-id "$APPLE_NOTARY_API_KEY_ID" \
  --issuer "$APPLE_NOTARY_API_ISSUER_ID" \
  --wait \
  --output-format json \
  >"$SUBMIT_JSON"
NOTARY_STATUS=$?
set -e

SUBMISSION_ID="$(python3 - "$SUBMIT_JSON" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    print("")
    raise SystemExit(0)

print(data.get("id", ""))
PY
)"

if ((NOTARY_STATUS != 0)); then
  if [[ -n "$SUBMISSION_ID" ]]; then
    xcrun notarytool log "$SUBMISSION_ID" \
      --key "$KEY_PATH" \
      --key-id "$APPLE_NOTARY_API_KEY_ID" \
      --issuer "$APPLE_NOTARY_API_ISSUER_ID" \
      || true
  fi
  fail "notarytool submit failed"
fi

xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"

SPCTL_STATUS=0
SPCTL_OUTPUT="$(spctl --assess --type execute --verbose=4 "$APP_PATH" 2>&1)" || SPCTL_STATUS=$?
printf '%s\n' "$SPCTL_OUTPUT"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '### Gatekeeper assessment\n\n'
    printf 'Exit status: `%s`\n\n' "$SPCTL_STATUS"
    printf '```text\n%s\n```\n' "$SPCTL_OUTPUT"
  } >>"$GITHUB_STEP_SUMMARY"
fi

if ((SPCTL_STATUS != 0)); then
  fail "spctl assessment failed"
fi

printf 'Notarized and stapled: %s\n' "$APP_PATH"
