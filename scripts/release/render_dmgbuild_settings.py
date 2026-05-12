#!/usr/bin/env python3
"""Render a concrete dmgbuild JSON settings file from the committed template."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


# JSON input is untyped until the template schema is validated below.
REQUIRED_TOP_LEVEL_KEYS = {
    "title",
    "background",
    "icon-size",
    "format",
    "window",
    "contents",
}
SENTINEL_PATTERN = re.compile(r"__[^_]+(?:_[^_]+)*__")


class SettingsError(ValueError):
    """Raised when the template cannot safely render into dmgbuild settings."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render dmgbuild JSON settings from the repo template."
    )
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--volume-name", required=True)
    parser.add_argument("--app-path", required=True, type=Path)
    parser.add_argument("--background-path", required=True, type=Path)
    return parser.parse_args()


def read_template(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        raise SettingsError(f"{path} is not valid JSON: {exc}") from exc
    except OSError as exc:
        raise SettingsError(f"could not read {path}: {exc}") from exc

    if not isinstance(data, dict):
        raise SettingsError("dmgbuild settings template must be a JSON object")
    return data


def validate_template(data: dict[str, Any]) -> None:
    missing = sorted(REQUIRED_TOP_LEVEL_KEYS.difference(data))
    if missing:
        raise SettingsError(f"settings template missing required keys: {missing}")
    if data["format"] != "UDZO":
        raise SettingsError('settings template must use "format": "UDZO"')
    if not isinstance(data["window"], dict):
        raise SettingsError("settings template window must be an object")
    if not isinstance(data["contents"], list) or not data["contents"]:
        raise SettingsError("settings template contents must be a non-empty array")

    for index, item in enumerate(data["contents"]):
        if not isinstance(item, dict):
            raise SettingsError(f"contents[{index}] must be an object")
        for key in ("x", "y", "type", "path", "name"):
            if key not in item:
                raise SettingsError(f"contents[{index}] missing required key: {key}")


def replace_sentinels(value: Any, replacements: dict[str, str]) -> Any:
    if isinstance(value, str):
        return replacements.get(value, value)
    if isinstance(value, list):
        return [replace_sentinels(item, replacements) for item in value]
    if isinstance(value, dict):
        return {
            key: replace_sentinels(item, replacements)
            for key, item in value.items()
        }
    return value


def find_unresolved_sentinel(value: Any) -> str | None:
    if isinstance(value, str):
        match = SENTINEL_PATTERN.search(value)
        return match.group(0) if match else None
    if isinstance(value, list):
        for item in value:
            found = find_unresolved_sentinel(item)
            if found:
                return found
    if isinstance(value, dict):
        for item in value.values():
            found = find_unresolved_sentinel(item)
            if found:
                return found
    return None


def main() -> int:
    args = parse_args()
    app_path = args.app_path.resolve()
    background_path = args.background_path.resolve()

    if not app_path.is_dir():
        raise SettingsError(f"app path does not exist or is not a directory: {app_path}")
    if not background_path.is_file():
        raise SettingsError(
            f"background path does not exist or is not a file: {background_path}"
        )

    data = read_template(args.template)
    validate_template(data)
    rendered = replace_sentinels(
        data,
        {
            "__VOLUME_NAME__": args.volume_name,
            "__APP_PATH__": str(app_path),
            "__BACKGROUND_SOURCE__": str(background_path),
        },
    )
    unresolved = find_unresolved_sentinel(rendered)
    if unresolved:
        raise SettingsError(f"unresolved sentinel in rendered settings: {unresolved}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(rendered, handle, indent=2)
        handle.write("\n")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SettingsError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
