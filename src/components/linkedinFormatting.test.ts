import { describe, expect, it } from "vitest";
import {
  detectUnsupportedConstructs,
  formatLinkedInUnicode,
} from "./linkedinFormatting";

describe("detectUnsupportedConstructs", () => {
  it("detects markdown tables", () => {
    expect(
      detectUnsupportedConstructs("| Name | Role |\n| --- | --- |\n| Anna | Admin |"),
    ).toBe("LinkedIn view is unavailable for Markdown tables.");
  });

  it("detects html tags", () => {
    expect(detectUnsupportedConstructs("<div>Wrapped</div>")).toBe(
      "LinkedIn view is unavailable for Markdown that includes HTML tags.",
    );
  });

  it("ignores pipe characters inside inline code", () => {
    expect(
      detectUnsupportedConstructs("Use `cat file | wc -l` before publishing."),
    ).toBeNull();
  });

  it("ignores html-like text inside fenced code blocks", () => {
    const markdown = [
      "```html",
      "<table><tr><td>debug</td></tr></table>",
      "```",
    ].join("\n");

    expect(detectUnsupportedConstructs(markdown)).toBeNull();
  });
});

describe("formatLinkedInUnicode", () => {
  it("formats supported markdown into plain unicode text", () => {
    const markdown = [
      "# Why release faster",
      "",
      "Shipping faster is not about **chaos**.",
      "",
      "## Benefits",
      "",
      "- Smaller changes",
      "  - Easier rollback",
      "1. Learn faster",
      "",
      "> Important point",
      "",
      "Read more at [Example](https://example.com).",
      "",
      "---",
      "",
      "Use `npm run build` before publishing.",
    ].join("\n");

    expect(formatLinkedInUnicode(markdown)).toBe([
      "Why release faster",
      "══════════════════",
      "",
      "Shipping faster is not about chaos.",
      "",
      "Benefits",
      "────────",
      "",
      "• Smaller changes",
      "  ◦ Easier rollback",
      "1. Learn faster",
      "",
      "│ Important point",
      "",
      "Read more at Example: https://example.com.",
      "",
      "──────",
      "",
      "Use npm run build before publishing.",
    ].join("\n"));
  });

  it("indents fenced code blocks as plain text", () => {
    const markdown = ["```bash", "npm run build", "npm run test", "```"].join(
      "\n",
    );

    expect(formatLinkedInUnicode(markdown)).toBe(
      ["  npm run build", "  npm run test"].join("\n"),
    );
  });

  it("produces deterministic output", () => {
    const markdown = "# Title\n\n- One\n- Two";

    expect(formatLinkedInUnicode(markdown)).toBe(
      formatLinkedInUnicode(markdown),
    );
  });
});
