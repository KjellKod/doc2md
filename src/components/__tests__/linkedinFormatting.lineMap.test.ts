import { describe, expect, it } from "vitest";
import { formatLinkedInUnicodeWithLineMap } from "../linkedinFormatting";

describe("formatLinkedInUnicodeWithLineMap", () => {
  it("emits a heading and an underline line both mapping to the heading's source line", () => {
    const input = "# Title";
    const { text, originalLineFor } = formatLinkedInUnicodeWithLineMap(input);

    const lines = text.split("\n");
    // Heading + underline (trailing blank trimmed by collapseOutputBlankLines).
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Title");
    // Underline char is `═` for h1.
    expect(lines[1]).toMatch(/^═+$/);
    expect(originalLineFor).toEqual([1, 1]);
  });

  it("maps the HR replacement and trailing blank to the HR's source line", () => {
    const input = "First\n\n---\n\nNext";
    const { text, originalLineFor } = formatLinkedInUnicodeWithLineMap(input);

    const lines = text.split("\n");
    // Expected: First, blank, ──────, blank, Next
    expect(lines[0]).toBe("First");
    expect(lines).toContain("──────");
    // The HR + trailing blank both map to source line 3 (the `---`).
    const hrIndex = lines.indexOf("──────");
    expect(originalLineFor[hrIndex]).toBe(3);
    if (hrIndex + 1 < lines.length && lines[hrIndex + 1].trim().length === 0) {
      expect(originalLineFor[hrIndex + 1]).toBe(3);
    }
  });

  it("rewrites a blockquote with its source line preserved", () => {
    const input = "> hello";
    const { text, originalLineFor } = formatLinkedInUnicodeWithLineMap(input);

    expect(text).toBe("│ hello");
    expect(originalLineFor).toEqual([1]);
  });

  it("flushes a multi-line paragraph into one line that references the first non-blank source line", () => {
    const input = "First sentence.\nSecond sentence.";
    const { text, originalLineFor } = formatLinkedInUnicodeWithLineMap(input);

    const lines = text.split("\n");
    expect(lines).toHaveLength(1);
    expect(originalLineFor).toEqual([1]);
  });

  it("indents fence body lines and preserves their original-source line numbers", () => {
    const input = "```\nconst a = 1;\nconst b = 2;\n```";
    const { text, originalLineFor } = formatLinkedInUnicodeWithLineMap(input);

    const lines = text.split("\n");
    expect(lines).toEqual(["  const a = 1;", "  const b = 2;"]);
    expect(originalLineFor).toEqual([2, 3]);
  });
});
