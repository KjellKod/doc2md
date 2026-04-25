import importlib.util
import subprocess
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "release" / "generate_appcast.py"


def load_module():
    spec = importlib.util.spec_from_file_location("generate_appcast", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ReleaseAppcastTests(unittest.TestCase):
    def test_generate_appcast_emits_required_fields(self):
        module = load_module()

        xml_text = module.build_appcast(
            version="42",
            short_version="1.2.3",
            enclosure_url="https://github.com/KjellKod/doc2md/releases/download/v1.2.3/doc2md-1.2.3.zip",
            enclosure_length=12345,
            ed_signature="abc123",
        )

        root = ET.fromstring(xml_text)
        ns = {"sparkle": module.SPARKLE_NS}
        item = root.find("./channel/item")
        self.assertIsNotNone(item)
        assert item is not None

        self.assertEqual(item.findtext("sparkle:version", namespaces=ns), "42")
        self.assertEqual(item.findtext("sparkle:shortVersionString", namespaces=ns), "1.2.3")
        enclosure = item.find("enclosure")
        self.assertIsNotNone(enclosure)
        assert enclosure is not None
        self.assertEqual(enclosure.attrib["length"], "12345")
        self.assertEqual(enclosure.attrib["type"], "application/octet-stream")
        self.assertEqual(enclosure.attrib[f"{{{module.SPARKLE_NS}}}edSignature"], "abc123")

    def test_generate_appcast_rejects_missing_required_flag(self):
        result = subprocess.run(
            [
                sys.executable,
                str(MODULE_PATH),
                "--version",
                "42",
                "--short-version",
                "1.2.3",
                "--enclosure-url",
                "https://example.invalid/doc2md.zip",
                "--enclosure-length",
                "123",
            ],
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--ed-signature", result.stderr)

    def test_generate_appcast_escapes_xml_special_chars(self):
        module = load_module()

        xml_text = module.build_appcast(
            version="100",
            short_version="1.0 & <2>",
            enclosure_url="https://example.invalid/doc2md?a=1&b=<two>",
            enclosure_length=99,
            ed_signature="sig&<value>",
        )

        root = ET.fromstring(xml_text)
        item = root.find("./channel/item")
        self.assertIsNotNone(item)
        assert item is not None
        self.assertEqual(item.findtext("title"), "doc2md 1.0 & <2>")
        enclosure = item.find("enclosure")
        self.assertIsNotNone(enclosure)
        assert enclosure is not None
        self.assertEqual(enclosure.attrib["url"], "https://example.invalid/doc2md?a=1&b=<two>")


if __name__ == "__main__":
    unittest.main()
