#!/usr/bin/env bash
# Regression guard for the Mac release P12 base64 decode.
# Run: bash tests/release/test_p12_decode.sh
#
# History: line-wrapped MACOS_CERTIFICATE secrets decoded to garbage on the
# macOS CI runners (BSD base64 mishandles embedded newlines), so `security
# import` failed with the cryptic "SecKeychainItemImport: Unknown format in
# import." decode_base64_secret now strips whitespace and validates that the
# decoded bytes are a DER-encoded PKCS#12 container. These tests lock that in.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SIGN_SCRIPT="$REPO_ROOT/scripts/release/sign_mac_app.sh"

if ! command -v openssl >/dev/null 2>&1; then
  echo "[SKIP] openssl not available; cannot build a test PKCS#12"
  exit 0
fi

# Source the signing script for its functions only. Its source-guard returns
# before the imperative signing flow, so nothing is signed and no keychain is
# touched.
# shellcheck disable=SC1090
source "$SIGN_SCRIPT"
# The sourced script sets `set -euo pipefail`; neutralize -e so this harness
# governs pass/fail through explicit return codes rather than aborting early.
set +e

WORK_DIR="$(mktemp -d)"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local name="$1"
  TESTS_RUN=$((TESTS_RUN + 1))
  if "$name"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "[PASS] $name"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "[FAIL] $name"
  fi
}

# Build a real PKCS#12 (cert + private key) for the round-trip tests.
make_p12() {
  local out="$1"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$WORK_DIR/key.pem" -out "$WORK_DIR/cert.pem" \
    -days 1 -subj '/CN=doc2md-test' >/dev/null 2>&1 || return 1
  openssl pkcs12 -export -inkey "$WORK_DIR/key.pem" -in "$WORK_DIR/cert.pem" \
    -out "$out" -passout pass:testpass >/dev/null 2>&1 || return 1
}

# The headline regression: a line-wrapped base64 secret (newlines every 76
# columns, exactly what `base64 -i cert.p12` produces) must decode back to the
# identical PKCS#12 bytes. Before the fix this produced a truncated file.
test_wrapped_base64_roundtrip() {
  local p12="$WORK_DIR/in.p12"
  make_p12 "$p12" || { echo "    could not create test p12" >&2; return 1; }

  # Force the 76-column line wrapping that `base64 -i cert.p12` (and `cat
  # cert.p12 | base64` on Linux) emits, regardless of this platform's base64
  # default. fold gives portable, deterministic wrapping.
  local wrapped
  wrapped="$(base64 < "$p12" | tr -d '\n' | fold -w 76)"
  # The test is only meaningful if the encoding is actually multi-line.
  [[ "$wrapped" == *$'\n'* ]] || { echo "    base64 output was not wrapped" >&2; return 1; }

  local out="$WORK_DIR/out.p12"
  ( decode_base64_secret "$wrapped" "$out" ) || return 1
  cmp -s "$p12" "$out"
}

# Whitespace-laden input (leading/trailing newlines and stray spaces) must also
# round-trip cleanly.
test_noisy_whitespace_roundtrip() {
  local p12="$WORK_DIR/in2.p12"
  make_p12 "$p12" || return 1

  local noisy
  noisy="$(printf '\n  %s  \n\n' "$(base64 < "$p12")")"

  local out="$WORK_DIR/out2.p12"
  ( decode_base64_secret "$noisy" "$out" ) || return 1
  cmp -s "$p12" "$out"
}

# A secret wrapped in stray quotes (a common copy-paste accident) must still
# round-trip; quotes are not valid base64 and are stripped before decoding.
test_quoted_secret_roundtrip() {
  local p12="$WORK_DIR/in3.p12"
  make_p12 "$p12" || return 1

  local quoted
  quoted="$(printf '"%s"' "$(base64 < "$p12" | tr -d '\n')")"

  local out="$WORK_DIR/out3.p12"
  ( decode_base64_secret "$quoted" "$out" 2>/dev/null ) || return 1
  cmp -s "$p12" "$out"
}

# An empty secret must fail loud here, not three steps downstream.
test_empty_secret_rejected() {
  local out="$WORK_DIR/empty.p12"
  ! ( decode_base64_secret "" "$out" 2>/dev/null )
}

# Valid base64 that decodes to something that is not a PKCS#12 container must be
# rejected by the DER magic-byte check.
test_non_p12_rejected() {
  local out="$WORK_DIR/junk.p12"
  local junk
  junk="$(printf 'this is plainly not a pkcs12 file' | base64)"
  ! ( decode_base64_secret "$junk" "$out" 2>/dev/null )
}

run_test test_wrapped_base64_roundtrip
run_test test_noisy_whitespace_roundtrip
run_test test_quoted_secret_roundtrip
run_test test_empty_secret_rejected
run_test test_non_p12_rejected

echo
echo "Ran $TESTS_RUN tests: $TESTS_PASSED passed, $TESTS_FAILED failed"
[[ "$TESTS_FAILED" -eq 0 ]]
