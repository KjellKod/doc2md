import { describe, expect, it } from "vitest";
import { formatPreviewMarkdown } from "./previewFormatting";

describe("formatPreviewMarkdown", () => {
  it("converts heading-like metadata blocks into preview lists", () => {
    const markdown = [
      "Contact",
      "Location: Chihuahua, Mexico",
      "Email: javier@example.com",
      "LinkedIn: https://example.com/in/javier"
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(
      [
        "### Contact",
        "",
        "- **Location:** Chihuahua, Mexico",
        "- **Email:** javier@example.com",
        "- **LinkedIn:** https://example.com/in/javier"
      ].join("\n")
    );
  });

  it("converts compact non-prose clusters into bullets", () => {
    const markdown = [
      "Strong SwiftUI delivery",
      "UIKit migration ownership",
      "Binary deployment workflow",
      "Team collaboration across design and backend"
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(
      [
        "- Strong SwiftUI delivery",
        "- UIKit migration ownership",
        "- Binary deployment workflow",
        "- Team collaboration across design and backend"
      ].join("\n")
    );
  });

  it("preserves tilde-fenced code blocks", () => {
    const markdown = [
      "~~~python",
      "def hello():",
      "    print('hello')",
      "~~~"
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("preserves multi-line tilde fence without corruption", () => {
    const markdown = [
      "Some text",
      "",
      "~~~",
      "Short line one",
      "Short line two",
      "Short line three",
      "Short line four",
      "~~~",
      "",
      "More text"
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("preserves leading whitespace on first line", () => {
    const markdown = "    indented code block\n    second line";

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("preserves trailing whitespace at end of document", () => {
    const markdown = "# Title\n\nSome content\n";

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("does not close backtick fence with tilde marker", () => {
    const markdown = [
      "```",
      "Short line one",
      "~~~",
      "Short line two",
      "Short line three",
      "Short line four",
      "```",
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("does not close tilde fence with backtick marker", () => {
    const markdown = [
      "~~~",
      "Short line one",
      "```",
      "Short line two",
      "Short line three",
      "Short line four",
      "~~~",
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("preserves multiple blank lines inside code fences", () => {
    const markdown = [
      "```",
      "line one",
      "",
      "",
      "",
      "line two",
      "```",
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });

  it("collapses triple blank lines outside code fences", () => {
    const markdown = "# Title\n\n\n\nSome content";
    const expected = "# Title\n\nSome content";

    expect(formatPreviewMarkdown(markdown)).toBe(expected);
  });

  it("preserves paragraph prose", () => {
    const markdown = [
      "This is a normal paragraph with enough context to read like prose rather than a compact",
      "metadata or checklist block, so the preview formatter should leave it alone."
    ].join("\n");

    expect(formatPreviewMarkdown(markdown)).toBe(markdown);
  });
});
