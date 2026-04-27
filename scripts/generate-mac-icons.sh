#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "error: macOS is required because this script uses /usr/bin/sips." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="$REPO_ROOT/apps/macos/doc2md/Resources/AppIconSource/doc2md-icon-1024.png"
DEST_DIR="$REPO_ROOT/apps/macos/doc2md/Resources/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$SOURCE" ]; then
  echo "error: missing source icon: $SOURCE" >&2
  exit 1
fi

width="$(/usr/bin/sips -g pixelWidth "$SOURCE" 2>/dev/null | awk '/pixelWidth/ { print $2 }')"
height="$(/usr/bin/sips -g pixelHeight "$SOURCE" 2>/dev/null | awk '/pixelHeight/ { print $2 }')"

if [ "$width" != "1024" ] || [ "$height" != "1024" ]; then
  echo "error: source icon must be 1024x1024 pixels; got ${width}x${height}." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

make_icon() {
  local pixels="$1"
  local filename="$2"
  /usr/bin/sips -s format png -z "$pixels" "$pixels" "$SOURCE" --out "$DEST_DIR/$filename" >/dev/null
}

make_icon 16 icon_16x16.png
make_icon 32 icon_16x16@2x.png
make_icon 32 icon_32x32.png
make_icon 64 icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
make_icon 1024 icon_512x512@2x.png

echo "Generated macOS app icon slots in $DEST_DIR"
