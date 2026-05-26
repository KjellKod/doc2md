import { describe, expect, it } from "vitest";
import { convertClipboardPasteToMarkdown } from "./pasteToMarkdown";

function googleDocParagraph(index: number) {
  return [
    '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">',
    `<span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Section ${index} body text from a large copied Google Doc.</span>`,
    "</p>",
  ].join("");
}

function googleDocHeading(index: number) {
  return [
    '<p dir="ltr" style="line-height:1.38;margin-top:20pt;margin-bottom:6pt;">',
    `<span style="font-size:20pt;font-family:Arial;font-weight:700;white-space:pre-wrap;">Heading ${index}</span>`,
    "</p>",
  ].join("");
}

function largeGoogleDocsLikeClipboard(sectionCount: number) {
  const htmlParts = ['<meta charset="utf-8">'];
  const plainParts: string[] = [];

  for (let index = 1; index <= sectionCount; index += 1) {
    htmlParts.push(googleDocHeading(index));
    htmlParts.push(googleDocParagraph(index));
    plainParts.push(`Heading ${index}`);
    plainParts.push(`Section ${index} body text from a large copied Google Doc.`);
  }

  return {
    html: htmlParts.join(""),
    plainText: plainParts.join("\n"),
  };
}

function googleDocsLikeClipboardRange(start: number, end: number) {
  const htmlParts = ['<meta charset="utf-8">'];
  const plainParts: string[] = [];

  for (let index = start; index <= end; index += 1) {
    htmlParts.push(googleDocHeading(index));
    htmlParts.push(googleDocParagraph(index));
    plainParts.push(`Heading ${index}`);
    plainParts.push(`Section ${index} body text from a large copied Google Doc.`);
  }

  return {
    html: htmlParts.join(""),
    plainText: plainParts.join("\n"),
  };
}

describe("large Google Docs paste reproduction", () => {
  it.each([500, 1000, 2000, 3000, 5000])(
    "converts both the first and last sections of a %i-section Google Docs-like payload",
    (sectionCount) => {
    const payload = largeGoogleDocsLikeClipboard(sectionCount);
    const started = performance.now();
    const result = convertClipboardPasteToMarkdown(payload);
    const durationMs = Math.round(performance.now() - started);
    console.log(`${sectionCount} sections converted in ${durationMs}ms`);

    expect(result.source).toBe("html");
    expect(result.markdown).toContain("# Heading 1");
    expect(result.markdown).toContain(
      "Section 1 body text from a large copied Google Doc.",
    );
    expect(result.markdown).toContain(`# Heading ${sectionCount}`);
    expect(result.markdown).toContain(
      `Section ${sectionCount} body text from a large copied Google Doc.`,
    );
    },
    60_000,
  );

  it("reproduces bottom-only conversion when clipboard HTML is truncated but plain text is complete", () => {
    const full = largeGoogleDocsLikeClipboard(1000);
    const bottomOnlyHtml = googleDocsLikeClipboardRange(850, 1000).html;

    const result = convertClipboardPasteToMarkdown({
      html: bottomOnlyHtml,
      plainText: full.plainText,
    });

    expect(result.source).toBe("plainText");
    const lines = result.markdown.split("\n");
    expect(lines).toContain("Heading 1");
    expect(lines).toContain("Heading 1000");
  });

  it("keeps the html path when meaningful clipboard HTML has markdown-like plain text", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        '<h1 style="font-size:20pt;font-weight:700;"># Planning Notes</h1>',
        "<p>---</p>",
        '<p><strong>**Status:**</strong> Draft</p>',
      ].join(""),
      plainText: [
        "# Planning Notes",
        "---",
        "**Status:** Draft",
      ].join("\n"),
    });

    expect(result.source).toBe("html");
    expect(result.markdown).toContain("# Planning Notes");
    expect(result.markdown).toContain("Status:");
    expect(result.markdown).toContain("Draft");
  });
});
