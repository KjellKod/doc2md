import importlib.util
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "build_pr_head_files.py"


def load_module():
    spec = importlib.util.spec_from_file_location("build_pr_head_files", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class BuildPrHeadFilesTests(unittest.TestCase):
    def test_decode_content_for_preview_when_binary_bytes_returns_placeholder(self):
        module = load_module()
        content = b"PK\x03\x04\x14\x00\x00\x00\x08\x00\xbc\x00\x00\x00"

        preview = module.decode_content_for_preview(content)

        self.assertEqual(preview, f"[binary file omitted: {len(content)} bytes]")

    def test_decode_content_for_preview_when_non_utf8_text_replaces_invalid_bytes(self):
        module = load_module()

        preview = module.decode_content_for_preview("café".encode("cp1252"))

        self.assertEqual(preview, "caf\ufffd")

    def test_clamp_preview_when_text_is_too_long_adds_truncation_marker(self):
        module = load_module()

        preview = module.clamp_preview("abcdef", max_chars=3)

        self.assertEqual(preview, "abc\n... [truncated]\n")


if __name__ == "__main__":
    unittest.main()
