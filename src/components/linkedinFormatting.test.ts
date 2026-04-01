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

  it("allows markdown autolinks instead of treating them as html", () => {
    expect(detectUnsupportedConstructs("See <https://example.com>")).toBeNull();
  });
});

describe("formatLinkedInUnicode", () => {
  it("formats supported markdown into plain unicode text", () => {
    const markdown = [
      "# Why release faster",
      "",
      "Shipping faster is not about **chaos**, *drama*, _guesswork_, or ~~panic~~.",
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
      "Shipping faster is not about 𝐜𝐡𝐚𝐨𝐬, 𝑑𝑟𝑎𝑚𝑎, 𝑔𝑢𝑒𝑠𝑠𝑤𝑜𝑟𝑘, or p̶a̶n̶i̶c̶.",
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

  it("formats markdown autolinks as plain visible urls", () => {
    expect(formatLinkedInUnicode("See <https://example.com> for details.")).toBe(
      "See https://example.com for details.",
    );
  });

  it("preserves inline bold, italic, underscore-style italic, and strikethrough", () => {
    const markdown =
      "**Bold** and *italic* and _underscore_ and ~~struck~~ stay visible.";

    expect(formatLinkedInUnicode(markdown)).toBe(
      "𝐁𝐨𝐥𝐝 and 𝑖𝑡𝑎𝑙𝑖𝑐 and 𝑢𝑛𝑑𝑒𝑟𝑠𝑐𝑜𝑟𝑒 and s̶t̶r̶u̶c̶k̶ stay visible.",
    );
  });

  it("does not leak raw emphasis markers around code-like signatures", () => {
    const markdown =
      "**`detectUnsupportedConstructs(markdown: string): string | null`**";

    expect(formatLinkedInUnicode(markdown)).toBe(
      "𝐝𝐞𝐭𝐞𝐜𝐭𝐔𝐧𝐬𝐮𝐩𝐩𝐨𝐫𝐭𝐞𝐝𝐂𝐨𝐧𝐬𝐭𝐫𝐮𝐜𝐭𝐬(𝐦𝐚𝐫𝐤𝐝𝐨𝐰𝐧: 𝐬𝐭𝐫𝐢𝐧𝐠): 𝐬𝐭𝐫𝐢𝐧𝐠 | 𝐧𝐮𝐥𝐥",
    );
  });

  it("indents fenced code blocks as plain text", () => {
    const markdown = ["```bash", "npm run build", "npm run test", "```"].join(
      "\n",
    );

    expect(formatLinkedInUnicode(markdown)).toBe(
      ["  npm run build", "  npm run test"].join("\n"),
    );
  });

  it("keeps stacked metadata lines structured instead of flattening them", () => {
    const markdown = [
      "**Agent:** Planner (Jean-Claude)",
      "**Model:** claude-opus-4-6",
      "**Date:** 2026-03-31",
      "**Quest ID:** linkedin-unicode-preview_2026-03-31__2103",
    ].join("\n");

    expect(formatLinkedInUnicode(markdown)).toBe(
      [
        "• Agent: Planner (Jean-Claude)",
        "• Model: claude-opus-4-6",
        "• Date: 2026-03-31",
        "• Quest ID: linkedin-unicode-preview_2026-03-31__2103",
      ].join("\n"),
    );
  });

  it("produces deterministic output", () => {
    const markdown = "# Title\n\n- One\n- Two";

    expect(formatLinkedInUnicode(markdown)).toBe(
      formatLinkedInUnicode(markdown),
    );
  });
});
