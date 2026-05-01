#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="Release"
VERSION=""
OUTPUT_DIR=".build/release"
SIGNED=0

usage() {
  cat <<'USAGE'
Usage: build-mac-dmg.sh [--version VERSION] [--configuration Debug|Release] [--output-dir DIR] [--signed]

Build doc2md.app and package it as a DMG.

By default this creates an unsigned local DMG:
  npm run build:dmg

Use --signed only after signing/notarization has already prepared a valid
CODESIGN_IDENTITY for the DMG packaging step.
USAGE
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

absolute_path() {
  local path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath "$path"
    return
  fi

  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$path"
}

display_build_version() {
  node --input-type=module -e "import { getDisplayVersionInfo } from './packages/core/scripts/release-version.mjs'; console.log(getDisplayVersionInfo().version);"
}

while (($#)); do
  case "$1" in
    --configuration)
      [[ $# -ge 2 ]] || fail "--configuration requires Debug or Release"
      CONFIGURATION="$2"
      shift 2
      ;;
    --version)
      [[ $# -ge 2 ]] || fail "--version requires a value"
      VERSION="$2"
      shift 2
      ;;
    --output-dir)
      [[ $# -ge 2 ]] || fail "--output-dir requires a directory"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --signed)
      SIGNED=1
      shift
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

case "$CONFIGURATION" in
  Debug|Release) ;;
  *) fail "--configuration must be Debug or Release" ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && /bin/pwd)"

cd "$REPO_ROOT"

if [[ -z "$VERSION" ]]; then
  VERSION="$(display_build_version)"
fi

bash scripts/build-mac-app.sh --configuration "$CONFIGURATION"

APP_PATH=".build/mac/Build/Products/$CONFIGURATION/doc2md.app"

if ((SIGNED)); then
  VERSION="$VERSION" OUTPUT_DIR="$OUTPUT_DIR" APP_PATH="$APP_PATH" \
    bash scripts/release/package_mac_dmg.sh
else
  VERSION="$VERSION" OUTPUT_DIR="$OUTPUT_DIR" RELEASE_DRY_RUN=1 APP_PATH="$APP_PATH" \
    bash scripts/release/package_mac_dmg.sh
fi

printf 'DMG: %s\n' "$(absolute_path "$OUTPUT_DIR/doc2md-$VERSION.dmg")"
printf 'Default npm shortcut: npm run build:dmg\n'
