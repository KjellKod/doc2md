import { describe, expect, it } from "vitest";
import {
  convertClipboardPasteToMarkdown,
  convertLinkedInUnicodeToMarkdown,
} from "./pasteToMarkdown";

describe("convertLinkedInUnicodeToMarkdown", () => {
  it("converts linkedin unicode emphasis to markdown", () => {
    expect(
      convertLinkedInUnicodeToMarkdown(
        "𝐁𝐨𝐥𝐝 and 𝑖𝑡𝑎𝑙𝑖𝑐 and 𝑩𝒐𝒍𝒅 𝒊𝒕𝒂𝒍𝒊𝒄 and ℎ",
      ),
    ).toBe("**Bold** and *italic* and ***Bold italic*** and *h*");
  });

  it("converts combining strikethrough and removes underline marks", () => {
    expect(
      convertLinkedInUnicodeToMarkdown("s̶t̶r̶u̶c̶k̶ and u̲n̲d̲e̲r̲"),
    ).toBe("~~struck~~ and under");
  });
});

describe("convertClipboardPasteToMarkdown", () => {
  it("prefers basic html clipboard content when conversion is non-empty", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<h2>Heading</h2>",
        "<p><strong>Bold</strong> and <em>italic</em> with ",
        '<a href="https://example.com">a link</a>.</p>',
        "<ul><li>One</li><li>Two</li></ul>",
        "<ol><li>First</li><li>Second</li></ol>",
      ].join(""),
      plainText: "Plain fallback",
    });

    expect(result.source).toBe("html");
    expect(result.markdown).toContain("## Heading");
    expect(result.markdown).toContain("**Bold**");
    expect(result.markdown).toContain("_italic_");
    expect(result.markdown).toContain("[a link](https://example.com)");
    expect(result.markdown).toContain("- One");
    expect(result.markdown).toMatch(/1\.\s+First/);
  });

  it("converts linkedin unicode inside html clipboard content", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p>𝐁𝐨𝐥𝐝 and 𝑖𝑡𝑎𝑙𝑖𝑐</p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "**Bold** and *italic*",
      source: "html",
    });
  });

  it("falls back to plain text when html conversion is empty", () => {
    expect(
      convertClipboardPasteToMarkdown({
        html: "<span>   </span>",
        plainText: "𝐁𝐨𝐥𝐝 fallback",
      }),
    ).toEqual({
      markdown: "**Bold** fallback",
      source: "plainText",
    });
  });
});
