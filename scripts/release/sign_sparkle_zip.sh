#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="${ZIP_PATH:-}"
OUTPUT_JSON="${OUTPUT_JSON:-sparkle-signature.json}"
PUBLIC_KEY_PATH="${PUBLIC_KEY_PATH:-apps/macos/doc2mdTests/Fixtures/Sparkle/test-public-key.txt}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

find_sign_update() {
  if [[ -n "${SPARKLE_SIGN_UPDATE_PATH:-}" ]]; then
    printf '%s\n' "$SPARKLE_SIGN_UPDATE_PATH"
    return
  fi

  local candidate
  for candidate in \
    ".build/mac/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update" \
    "apps/macos/.build/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  fail "could not find Sparkle sign_update; set SPARKLE_SIGN_UPDATE_PATH"
}

verify_with_committed_public_key() {
  local zip_path="$1"
  local signature="$2"
  local public_key_path="$3"

  [[ -f "$public_key_path" ]] || fail "committed Sparkle public key is missing: $public_key_path"

  local work_dir
  work_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/doc2md-sparkle-verify.XXXXXX")"
  local verifier="$work_dir/verify.swift"
  cat >"$verifier" <<'SWIFT'
import CryptoKit
import Foundation

guard CommandLine.arguments.count == 4 else {
    FileHandle.standardError.write(Data("Usage: verify.swift <zip> <signature-base64> <public-key-file>\n".utf8))
    exit(2)
}

let archiveURL = URL(fileURLWithPath: CommandLine.arguments[1])
let signatureText = CommandLine.arguments[2]
let publicKeyURL = URL(fileURLWithPath: CommandLine.arguments[3])

let archive = try Data(contentsOf: archiveURL)
guard let signature = Data(base64Encoded: signatureText) else {
    FileHandle.standardError.write(Data("Sparkle signature is not valid base64\n".utf8))
    exit(2)
}
let publicKeyText = try String(contentsOf: publicKeyURL, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
guard let publicKeyData = Data(base64Encoded: publicKeyText) else {
    FileHandle.standardError.write(Data("Sparkle public key is not valid base64\n".utf8))
    exit(2)
}

let publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyData)
if publicKey.isValidSignature(signature, for: archive) {
    exit(0)
}

FileHandle.standardError.write(Data("Sparkle signature does not verify against committed SUPublicEDKey\n".utf8))
exit(1)
SWIFT

  swift "$verifier" "$zip_path" "$signature" "$public_key_path"
  rm -rf "$work_dir"
}

[[ -n "$ZIP_PATH" ]] || fail "ZIP_PATH is required"
[[ -f "$ZIP_PATH" ]] || fail "ZIP_PATH does not exist: $ZIP_PATH"

SIGN_UPDATE="$(find_sign_update)"
[[ -x "$SIGN_UPDATE" ]] || fail "sign_update is not executable: $SIGN_UPDATE"

mkdir -p "$(dirname "$OUTPUT_JSON")"

if [[ "${RELEASE_DRY_RUN:-0}" == "1" ]]; then
  ZIP_BYTES="$(stat -f %z "$ZIP_PATH")"
  python3 - "$OUTPUT_JSON" "$ZIP_BYTES" <<'PY'
import json
import sys

with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump({"edSignature": "DRY_RUN_SIGNATURE", "length": int(sys.argv[2])}, handle, indent=2)
    handle.write("\n")
PY
  printf 'Dry run: wrote placeholder Sparkle signature metadata to %s\n' "$OUTPUT_JSON"
  exit 0
fi

[[ -n "${SPARKLE_EDDSA_PRIVATE_KEY:-}" ]] || fail "SPARKLE_EDDSA_PRIVATE_KEY is required"

SIGN_OUTPUT="$(printf '%s' "$SPARKLE_EDDSA_PRIVATE_KEY" | "$SIGN_UPDATE" --ed-key-file - "$ZIP_PATH")"
ED_SIGNATURE="$(python3 - "$SIGN_OUTPUT" <<'PY'
import re
import sys

text = sys.argv[1]
match = re.search(r'sparkle:edSignature="([^"]+)"', text)
if not match:
    match = re.search(r'edSignature="([^"]+)"', text)
if not match:
    raise SystemExit("sign_update output did not include an EdDSA signature")
print(match.group(1))
PY
)"
ZIP_BYTES="$(python3 - "$SIGN_OUTPUT" "$ZIP_PATH" <<'PY'
import os
import re
import sys

text = sys.argv[1]
match = re.search(r'length="([0-9]+)"', text)
if match:
    print(match.group(1))
else:
    print(os.path.getsize(sys.argv[2]))
PY
)"

printf '%s' "$SPARKLE_EDDSA_PRIVATE_KEY" | "$SIGN_UPDATE" --ed-key-file - --verify "$ZIP_PATH" "$ED_SIGNATURE"
verify_with_committed_public_key "$ZIP_PATH" "$ED_SIGNATURE" "$PUBLIC_KEY_PATH"

python3 - "$OUTPUT_JSON" "$ED_SIGNATURE" "$ZIP_BYTES" <<'PY'
import json
import sys

with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump({"edSignature": sys.argv[2], "length": int(sys.argv[3])}, handle, indent=2)
    handle.write("\n")
PY

printf 'Wrote Sparkle signature metadata to %s\n' "$OUTPUT_JSON"
