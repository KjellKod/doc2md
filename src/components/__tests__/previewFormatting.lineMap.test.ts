import { describe, expect, it } from "vitest";
import { formatPreviewMarkdownWithLineMap } from "../previewFormatting";

describe("formatPreviewMarkdownWithLineMap", () => {
  it("produces an identity map for pass-through input", () => {
    const input = "# Title\n\nParagraph text.\n\n- item one\n- item two";
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    // The formatter passes structural lines through verbatim.
    expect(markdown).toBe(input);

    const formattedLines = markdown.split("\n");
    expect(originalLineFor.length).toBe(formattedLines.length);
    // Each formatted line maps to its own original line.
    for (let index = 0; index < originalLineFor.length; index += 1) {
      expect(originalLineFor[index]).toBe(index + 1);
    }
  });

  it("preserves parenthesized ordered lists as structural markdown", () => {
    const input = [
      "1) [ ] First task",
      "2) [ ] Second task",
      "3) [x] Third task",
      "4) [ ] Fourth task",
    ].join("\n");
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    expect(markdown).toBe(input);
    expect(originalLineFor).toEqual([1, 2, 3, 4]);
  });

  it("collapses consecutive blank lines while preserving the surviving blank's source", () => {
    const input = "# Heading\n\n\n\nParagraph";
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    const formattedLines = markdown.split("\n");
    // Heading + 1 blank + paragraph (the consecutive blanks collapse).
    expect(formattedLines).toEqual(["# Heading", "", "Paragraph"]);
    expect(originalLineFor).toEqual([1, 2, 5]);
  });

  it("emits ### Heading and bullets with each output line referencing its compact source line", () => {
    const input = [
      "Contact",
      "Location: Chihuahua, Mexico",
      "Email: javier@example.com",
      "LinkedIn: https://example.com/in/javier",
      "Github: https://github.com/javier",
    ].join("\n");

    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    const formattedLines = markdown.split("\n");
    expect(formattedLines[0]).toBe("### Contact");
    // Heading + blank + 4 bullets = 6 output lines.
    expect(formattedLines).toHaveLength(6);
    expect(originalLineFor).toHaveLength(6);

    // Heading and synthetic blank inherit the heading's source line.
    expect(originalLineFor[0]).toBe(1);
    expect(originalLineFor[1]).toBe(1);
    // Bullets carry the source line of their compact line.
    expect(originalLineFor[2]).toBe(2);
    expect(originalLineFor[3]).toBe(3);
    expect(originalLineFor[4]).toBe(4);
    expect(originalLineFor[5]).toBe(5);
  });

  it("preserves fenced code line-by-line as identity", () => {
    const input = "```ts\nconst a = 1;\nconst b = 2;\n```";
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    expect(markdown).toBe(input);
    expect(originalLineFor).toEqual([1, 2, 3, 4]);
  });

  it("returns empty markdown and an empty map for empty input", () => {
    const { markdown, originalLineFor } = formatPreviewMarkdownWithLineMap("");
    expect(markdown).toBe("");
    expect(originalLineFor).toEqual([]);
  });

  it("handles a single-line input without a trailing newline", () => {
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap("Hello");
    expect(markdown).toBe("Hello");
    expect(originalLineFor).toEqual([1]);
  });

  it("treats a document fully inside a fence as identity", () => {
    const input = "```\nentirely code\nstill code\n```";
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    expect(markdown).toBe(input);
    expect(originalLineFor).toEqual([1, 2, 3, 4]);
  });

  it("treats CRLF input the same as LF and references original line numbers", () => {
    const input = "# Heading\r\n\r\nParagraph";
    const { markdown, originalLineFor } =
      formatPreviewMarkdownWithLineMap(input);

    const formattedLines = markdown.split("\n");
    expect(formattedLines).toEqual(["# Heading", "", "Paragraph"]);
    expect(originalLineFor).toEqual([1, 2, 3]);
  });
});
