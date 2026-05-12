#!/usr/bin/env python3
"""Shared assertions for doc2md DMG Finder metadata."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from ds_store import DSStore
from mac_alias import Alias


EXPECTED_WINDOW_BOUNDS = (100, 100, 820, 560)
EXPECTED_ICON_SIZE = 96
EXPECTED_BACKGROUND_TYPE = 2
EXPECTED_APP_ILOC = (190, 205)
EXPECTED_APPLICATIONS_ILOC = (515, 205)
EXPECTED_BACKGROUND_FILENAME = ".background.png"
TOLERANCE = 5

# DSStore plist/alias records are untyped parser-boundary data.

class LayoutMismatch(AssertionError):
    """Raised when mounted DMG layout metadata does not match expectations."""


def fail(message: str) -> None:
    raise LayoutMismatch(message)


def assert_close_tuple(
    label: str,
    actual: tuple[int, ...],
    expected: tuple[int, ...],
    tolerance: int = TOLERANCE,
) -> None:
    if len(actual) != len(expected):
        fail(f"{label} expected {expected}, got {actual}")
    for actual_value, expected_value in zip(actual, expected, strict=True):
        if abs(actual_value - expected_value) > tolerance:
            fail(f"{label} expected {expected} +/-{tolerance}, got {actual}")


def parse_window_bounds(value: Any) -> tuple[int, int, int, int]:
    if not isinstance(value, str):
        fail(f"bwsp.WindowBounds expected plist string, got {type(value).__name__}")
    match = re.fullmatch(
        r"\{\{\s*(-?\d+)\s*,\s*(-?\d+)\s*\}\s*,\s*\{\s*(-?\d+)\s*,\s*(-?\d+)\s*\}\}",
        value,
    )
    if not match:
        fail(f"bwsp.WindowBounds has unexpected format: {value!r}")
    x, y, width, height = (int(part) for part in match.groups())
    return (x, y, x + width, y + height)


def decode_background_alias(value: Any) -> str:
    if isinstance(value, bytearray):
        value = bytes(value)
    if not isinstance(value, bytes):
        fail(
            "icvp.backgroundImageAlias expected Alias bytes, "
            f"got {type(value).__name__}"
        )
    try:
        alias = Alias.from_bytes(value)
        filename = alias.target.filename
        if isinstance(filename, bytes):
            filename = filename.decode("utf-8")
    except Exception as exc:
        preview = repr(value)
        if len(preview) > 96:
            preview = f"{repr(value[:48])}..."
        fail(
            "icvp.backgroundImageAlias decode failed: "
            f"{preview} (length={len(value)}): {type(exc).__name__}"
        )
    return filename


def read_ds_store_records(ds_store_path: Path) -> dict[str, Any]:
    if not ds_store_path.exists():
        fail(f"missing .DS_Store at {ds_store_path}")
    if ds_store_path.stat().st_size <= 0:
        fail(f".DS_Store is empty at {ds_store_path}")

    with DSStore.open(str(ds_store_path), "r") as store:
        try:
            bwsp = store["."]["bwsp"]
            icvp = store["."]["icvp"]
            app_iloc = store["doc2md.app"]["Iloc"]
            applications_iloc = store["Applications"]["Iloc"]
        except KeyError as exc:
            raise LayoutMismatch(f".DS_Store missing expected record: {exc}") from exc

    window_bounds = parse_window_bounds(bwsp.get("WindowBounds"))
    background_filename = decode_background_alias(icvp.get("backgroundImageAlias"))

    icon_size = icvp.get("iconSize")
    background_type = icvp.get("backgroundType")
    if icon_size is None:
        fail(".DS_Store missing icvp.iconSize")
    if background_type is None:
        fail(".DS_Store missing icvp.backgroundType")
    if float(icon_size) != float(EXPECTED_ICON_SIZE):
        fail(f"icvp.iconSize expected {EXPECTED_ICON_SIZE}, got {icon_size}")
    if int(background_type) != EXPECTED_BACKGROUND_TYPE:
        fail(
            f"icvp.backgroundType expected {EXPECTED_BACKGROUND_TYPE}, "
            f"got {background_type}"
        )

    return {
        "window_bounds": window_bounds,
        "icon_size": int(icon_size),
        "background_type": int(background_type),
        "background_alias_filename": background_filename,
        "doc2md_app_iloc": tuple(int(value) for value in app_iloc),
        "applications_iloc": tuple(int(value) for value in applications_iloc),
    }


def assert_mounted_layout(
    mount_path: Path,
    background_source: Path,
) -> dict[str, Any]:
    app_path = mount_path / "doc2md.app"
    applications_path = mount_path / "Applications"
    background_path = mount_path / EXPECTED_BACKGROUND_FILENAME
    ds_store_path = mount_path / ".DS_Store"

    if not app_path.is_dir():
        fail("missing doc2md.app at volume root")
    if not applications_path.is_symlink():
        fail("Applications is not a symlink")
    target = applications_path.readlink()
    if str(target) != "/Applications":
        fail(f"Applications symlink expected /Applications, got {target}")
    if not background_path.is_file():
        fail(f"missing {EXPECTED_BACKGROUND_FILENAME} at volume root")
    if background_path.read_bytes() != background_source.read_bytes():
        fail(
            f"{EXPECTED_BACKGROUND_FILENAME} bytes do not match "
            f"{background_source}"
        )

    records = read_ds_store_records(ds_store_path)
    if records["background_alias_filename"] != EXPECTED_BACKGROUND_FILENAME:
        fail(
            "icvp.backgroundImageAlias expected "
            f"{EXPECTED_BACKGROUND_FILENAME}, got "
            f"{records['background_alias_filename']}"
        )
    assert_close_tuple(
        "bwsp.WindowBounds",
        records["window_bounds"],
        EXPECTED_WINDOW_BOUNDS,
    )
    assert_close_tuple(
        "doc2md.app Iloc",
        records["doc2md_app_iloc"],
        EXPECTED_APP_ILOC,
    )
    assert_close_tuple(
        "Applications Iloc",
        records["applications_iloc"],
        EXPECTED_APPLICATIONS_ILOC,
    )
    return records


def records_json(mount_path: Path) -> str:
    records = read_ds_store_records(mount_path / ".DS_Store")
    return json.dumps(records, indent=2, sort_keys=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    records_parser = subparsers.add_parser("records")
    records_parser.add_argument("mount_path", type=Path)
    args = parser.parse_args()

    if args.command == "records":
        print(records_json(args.mount_path))
        return 0

    raise AssertionError(f"unexpected command: {args.command}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except LayoutMismatch as exc:
        print(f"DMG layout mismatch: {exc}", file=sys.stderr)
        raise SystemExit(1)
