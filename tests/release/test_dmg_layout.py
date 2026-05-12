#!/usr/bin/env python3
"""Mount an existing doc2md DMG and assert its Finder layout metadata."""

from __future__ import annotations

import argparse
import plistlib
import subprocess
import sys
import tempfile
from pathlib import Path

from dmg_layout_assertions import (
    LayoutMismatch,
    assert_mounted_layout,
    decode_background_alias,
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def run(command: list[str], check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def command_output(result: subprocess.CompletedProcess[bytes]) -> str:
    output = result.stderr or result.stdout or b""
    return output.decode("utf-8", errors="replace").strip()


def detach(target: str) -> None:
    result = run(["hdiutil", "detach", target], check=False)
    if result.returncode == 0:
        return
    forced = run(["hdiutil", "detach", "-force", target], check=False)
    if forced.returncode == 0:
        return
    raise LayoutMismatch(
        f"failed to detach {target}: "
        f"normal detach stderr={command_output(result)!r}; "
        f"force detach stderr={command_output(forced)!r}"
    )


def hdiutil_info() -> dict:
    result = run(["hdiutil", "info", "-plist"])
    return plistlib.loads(result.stdout)


def detach_stale_doc2md_mounts() -> None:
    for image in hdiutil_info().get("images", []):
        for entity in image.get("system-entities", []):
            mount_point = entity.get("mount-point")
            if mount_point and Path(mount_point).name.startswith("doc2md"):
                detach(mount_point)


def attach_readonly(dmg_path: Path, mount_path: Path) -> str:
    result = run(
        [
            "hdiutil",
            "attach",
            str(dmg_path),
            "-readonly",
            "-nobrowse",
            "-noautoopen",
            "-mountpoint",
            str(mount_path),
            "-plist",
        ]
    )
    data = plistlib.loads(result.stdout)
    for entity in data.get("system-entities", []):
        device = entity.get("dev-entry")
        mounted = entity.get("mount-point")
        if mounted == str(mount_path) and device:
            return device
    return str(mount_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Mount a doc2md DMG and assert drag-install layout metadata."
    )
    parser.add_argument("dmg", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dmg_path = args.dmg.resolve()
    if not dmg_path.is_file():
        print(f"DMG layout mismatch: missing DMG {dmg_path}", file=sys.stderr)
        return 1

    background_source = (
        repo_root() / "apps/macos/dmg/doc2md-dmg-background.png"
    ).resolve()

    try:
        detach_stale_doc2md_mounts()
        with tempfile.TemporaryDirectory(prefix="doc2md-dmg-layout.") as temp_dir:
            mount_path = Path(temp_dir) / "mount"
            mount_path.mkdir()
            detach_target = ""
            try:
                detach_target = attach_readonly(dmg_path, mount_path)
                records = assert_mounted_layout(mount_path, background_source)
            finally:
                if detach_target:
                    detach(detach_target)
    except LayoutMismatch as exc:
        print(f"DMG layout mismatch: {exc}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        output = (exc.stderr or exc.stdout or b"").decode("utf-8", errors="replace")
        print(
            f"DMG layout mismatch: command failed ({' '.join(exc.cmd)}): "
            f"{output.strip()}",
            file=sys.stderr,
        )
        return exc.returncode or 1

    print(
        "DMG layout test passed: .DS_Store, .background.png, symlink, "
        f"and icon records match ({records})"
    )
    return 0


def test_detach_raises_after_normal_and_force_detach_fail(monkeypatch) -> None:
    calls = []

    def fake_run(
        command: list[str],
        check: bool = True,
    ) -> subprocess.CompletedProcess[bytes]:
        calls.append(command)
        return subprocess.CompletedProcess(command, 1, b"", b"busy")

    monkeypatch.setattr(sys.modules[__name__], "run", fake_run)
    try:
        detach("/Volumes/doc2md stale")
    except LayoutMismatch as exc:
        message = str(exc)
    else:
        raise AssertionError("detach should raise LayoutMismatch")

    assert calls == [
        ["hdiutil", "detach", "/Volumes/doc2md stale"],
        ["hdiutil", "detach", "-force", "/Volumes/doc2md stale"],
    ]
    assert "failed to detach /Volumes/doc2md stale" in message
    assert "force detach stderr='busy'" in message


def test_decode_background_alias_reports_malformed_bytes_as_layout_mismatch() -> None:
    try:
        decode_background_alias(b"")
    except LayoutMismatch as exc:
        message = str(exc)
    else:
        raise AssertionError("malformed alias bytes should raise LayoutMismatch")

    assert "icvp.backgroundImageAlias decode failed" in message
    assert "length=0" in message


def test_detach_stale_doc2md_mounts_surfaces_detach_failure(monkeypatch) -> None:
    monkeypatch.setattr(
        sys.modules[__name__],
        "hdiutil_info",
        lambda: {
            "images": [
                {"system-entities": [{"mount-point": "/Volumes/doc2md old"}]},
            ]
        },
    )

    def fake_detach(target: str) -> None:
        raise LayoutMismatch(f"failed to detach {target}")

    monkeypatch.setattr(sys.modules[__name__], "detach", fake_detach)
    try:
        detach_stale_doc2md_mounts()
    except LayoutMismatch as exc:
        assert "failed to detach /Volumes/doc2md old" in str(exc)
    else:
        raise AssertionError("stale teardown should surface detach failures")


def test_main_reports_final_detach_failure(monkeypatch, tmp_path, capsys) -> None:
    dmg_path = tmp_path / "doc2md.dmg"
    dmg_path.write_bytes(b"dmg")
    mount_path_seen: list[Path] = []

    monkeypatch.setattr(
        sys.modules[__name__],
        "detach_stale_doc2md_mounts",
        lambda: None,
    )
    monkeypatch.setattr(
        sys.modules[__name__],
        "attach_readonly",
        lambda _dmg_path, mount_path: mount_path_seen.append(mount_path) or "disk9",
    )
    monkeypatch.setattr(
        sys.modules[__name__],
        "assert_mounted_layout",
        lambda _mount_path, _background_source: {"ok": True},
    )

    def fake_detach(target: str) -> None:
        raise LayoutMismatch(f"failed to detach {target}")

    monkeypatch.setattr(sys.modules[__name__], "detach", fake_detach)
    monkeypatch.setattr(sys, "argv", ["test_dmg_layout.py", str(dmg_path)])

    assert main() == 1
    assert mount_path_seen
    assert "DMG layout mismatch: failed to detach disk9" in capsys.readouterr().err


if __name__ == "__main__":
    raise SystemExit(main())
