#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.dom import minidom
from xml.etree import ElementTree as ET


SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle"
ET.register_namespace("sparkle", SPARKLE_NS)


def positive_int(value: str) -> int:
    try:
        parsed = int(value, 10)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def build_appcast(
    *,
    version: str,
    short_version: str,
    enclosure_url: str,
    enclosure_length: int,
    ed_signature: str,
) -> str:
    rss = ET.Element(
        "rss",
        {
            "version": "2.0",
        },
    )
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "doc2md releases"
    ET.SubElement(channel, "description").text = "Release updates for doc2md.app"
    ET.SubElement(channel, "language").text = "en"

    item = ET.SubElement(channel, "item")
    ET.SubElement(item, "title").text = f"doc2md {short_version}"
    ET.SubElement(item, "pubDate").text = format_datetime(datetime.now(timezone.utc))
    ET.SubElement(item, f"{{{SPARKLE_NS}}}version").text = version
    ET.SubElement(item, f"{{{SPARKLE_NS}}}shortVersionString").text = short_version
    ET.SubElement(
        item,
        "enclosure",
        {
            "url": enclosure_url,
            "length": str(enclosure_length),
            "type": "application/octet-stream",
            f"{{{SPARKLE_NS}}}edSignature": ed_signature,
        },
    )

    rough = ET.tostring(rss, encoding="utf-8", xml_declaration=True)
    return minidom.parseString(rough).toprettyxml(indent="  ")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the doc2md Sparkle appcast.")
    parser.add_argument("--version", required=True, help="CFBundleVersion / Sparkle build version")
    parser.add_argument("--short-version", required=True, help="CFBundleShortVersionString / marketing version")
    parser.add_argument("--enclosure-url", required=True, help="Release ZIP URL")
    parser.add_argument("--enclosure-length", required=True, type=positive_int, help="Release ZIP byte length")
    parser.add_argument("--ed-signature", required=True, help="Sparkle EdDSA signature")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    sys.stdout.write(
        build_appcast(
            version=args.version,
            short_version=args.short_version,
            enclosure_url=args.enclosure_url,
            enclosure_length=args.enclosure_length,
            ed_signature=args.ed_signature,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
