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
  it("converts Google Docs-style headings, inline styles, lists, and checkboxes to markdown", () => {
    const googleDocsClipboardHtml = [
      '<meta charset="utf-8">',
      '<p dir="ltr" style="line-height:1.38;margin-top:20pt;margin-bottom:6pt;">',
      '<span style="font-size:20pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:700;font-style:normal;white-space:pre-wrap;">Launch Plan</span>',
      "</p>",
      '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">',
      '<span style="font-size:11pt;font-family:Arial;font-weight:700;white-space:pre-wrap;">Bold priority</span>',
      '<span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;"> and </span>',
      '<span style="font-size:11pt;font-family:Arial;font-style:italic;white-space:pre-wrap;">italic detail</span>',
      "</p>",
      "<ul>",
      '<li><span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Normal item</span></li>',
      '<li><input type="checkbox" checked><span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Done task</span></li>',
      '<li><input type="checkbox"><span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Open task</span></li>',
      "</ul>",
    ].join("");

    expect(
      convertClipboardPasteToMarkdown({
        html: googleDocsClipboardHtml,
        plainText: "Launch Plan\nBold priority and italic detail\nNormal item\nDone task\nOpen task",
      }),
    ).toEqual({
      markdown: [
        "# Launch Plan",
        "",
        "**Bold priority** and _italic detail_",
        "",
        "- Normal item",
        "- [x] Done task",
        "- [ ] Open task",
      ].join("\n"),
      source: "html",
    });
  });

  it("converts common sans-serif LinkedIn unicode emphasis to markdown", () => {
    expect(
      convertClipboardPasteToMarkdown({
        html: "",
        plainText: "𝗕𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤",
      }),
    ).toEqual({
      markdown: "**Bold** and *italic*",
      source: "plainText",
    });
  });

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

  it("does not duplicate markdown markers for unicode inside semantic html", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p><strong>𝐁𝐨𝐥𝐝</strong> and <em>𝑖𝑡𝑎𝑙𝑖𝑐</em></p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "**Bold** and _italic_",
      source: "html",
    });
  });

  it("does not treat underscores in html link destinations as markdown emphasis", () => {
    const result = convertClipboardPasteToMarkdown({
      html: '<p><a href="https://example.com/a_b">link</a> 𝑖𝑡𝑎𝑙𝑖𝑐</p>',
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "[link](https://example.com/a_b) *italic*",
      source: "html",
    });
  });

  it("does not convert unicode inside multi-backtick html code spans", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p><code>`𝐁𝐨𝐥𝐝`</code> 𝑖𝑡𝑎𝑙𝑖𝑐</p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "`` `𝐁𝐨𝐥𝐝` `` *italic*",
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
