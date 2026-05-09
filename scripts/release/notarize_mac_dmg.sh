#!/usr/bin/env bash
set -euo pipefail

VERSION="${VERSION:-}"
OUTPUT_DIR="${OUTPUT_DIR:-.build/release}"
DMG_PATH="${DMG_PATH:-}"

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

append_step_summary() {
  local title="$1"
  local command="$2"
  local status="$3"
  local output="$4"

  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      printf '### %s\n\n' "$title"
      printf 'Command: `%s`\n\n' "$command"
      printf 'Exit status: `%s`\n\n' "$status"
      printf '```text\n%s\n```\n\n' "$output"
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

run_validation() {
  local title="$1"
  local command_display="$2"
  shift 2
  local status=0
  local output

  output="$("$@" 2>&1)" || status=$?
  printf '%s\n' "$output"
  append_step_summary "$title" "$command_display" "$status" "$output"

  if ((status != 0)); then
    fail "$title failed"
  fi
}

if [[ -z "$DMG_PATH" ]]; then
  [[ -n "$VERSION" ]] || fail "VERSION is required when DMG_PATH is not set"
  DMG_PATH="$OUTPUT_DIR/doc2md-${VERSION}.dmg"
fi

[[ -f "$DMG_PATH" ]] || fail "DMG_PATH does not point to a DMG file: $DMG_PATH"

if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
  printf 'Dry run: would notarize, staple, validate, and assess %s\n' "$DMG_PATH"
  exit 0
fi

for name in APPLE_NOTARY_API_KEY_P8 APPLE_NOTARY_API_KEY_ID APPLE_NOTARY_API_ISSUER_ID; do
  [[ -n "${!name:-}" ]] || fail "$name is required"
done

WORK_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-dmg-notary.XXXXXX")"
KEY_PATH="$WORK_DIR/AuthKey_${APPLE_NOTARY_API_KEY_ID}.p8"
SUBMIT_JSON="$WORK_DIR/notary-submit.json"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

write_notary_key "$KEY_PATH"
chmod 600 "$KEY_PATH"

set +e
xcrun notarytool submit "$DMG_PATH" \
  --key "$KEY_PATH" \
  --key-id "$APPLE_NOTARY_API_KEY_ID" \
  --issuer "$APPLE_NOTARY_API_ISSUER_ID" \
  --wait \
  --output-format json \
  >"$SUBMIT_JSON"
NOTARY_STATUS=$?
set -e

read -r SUBMISSION_ID SUBMISSION_STATUS < <(python3 - "$SUBMIT_JSON" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    print(" ")
    raise SystemExit(0)

print(data.get("id", ""), data.get("status", ""))
PY
)

if ((NOTARY_STATUS != 0)) || [[ "$SUBMISSION_STATUS" != "Accepted" ]]; then
  if [[ -n "$SUBMISSION_ID" ]]; then
    xcrun notarytool log "$SUBMISSION_ID" \
      --key "$KEY_PATH" \
      --key-id "$APPLE_NOTARY_API_KEY_ID" \
      --issuer "$APPLE_NOTARY_API_ISSUER_ID" \
      || true
  fi
  fail "notarytool submit did not return Accepted status for $DMG_PATH (status: ${SUBMISSION_STATUS:-unknown})"
fi

xcrun stapler staple "$DMG_PATH"

run_validation \
  "DMG codesign verification" \
  "codesign --verify --strict --verbose=2 \"$DMG_PATH\"" \
  codesign --verify --strict --verbose=2 "$DMG_PATH"

run_validation \
  "DMG stapler validation" \
  "xcrun stapler validate \"$DMG_PATH\"" \
  xcrun stapler validate "$DMG_PATH"

run_validation \
  "DMG Gatekeeper assessment" \
  "spctl --assess --type open --context context:primary-signature --verbose=4 \"$DMG_PATH\"" \
  spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"

printf 'Notarized and stapled DMG: %s\n' "$DMG_PATH"
