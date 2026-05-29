import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./markdownToHtml";

const SAMPLE = `# Title Heading

Intro paragraph with **bold**, _italic_, and \`inline code\`.

## Section Two

- [ ] unchecked task
- [x] checked task

| Name | Score |
| ---- | ----- |
| Ada  | 10    |
| Bob  | 7     |

> A blockquote line.

\`\`\`ts
const value = 1;
\`\`\`

[External](https://example.com) and [Anchor](#section-two) and [Repo](../README.md).

~~struck~~
`;

describe("markdownToHtml standalone shell", () => {
  const html = markdownToHtml(SAMPLE);

  it("emits a self-contained document scaffold", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("<title>");
    expect(html).toContain('<main class="markdown-surface">');
  });

  it("derives the title from the first heading when none is given", () => {
    expect(html).toMatch(/<title>Title Heading<\/title>/);
  });

  it("uses an explicit title when provided", () => {
    const titled = markdownToHtml(SAMPLE, { title: "Custom Name" });
    expect(titled).toMatch(/<title>Custom Name<\/title>/);
  });

  it("honors a custom lang", () => {
    expect(markdownToHtml("# x", { lang: "fr" })).toContain('<html lang="fr">');
  });

  it("contains exactly one embedded style block and no scripts or external refs", () => {
    expect((html.match(/<style>/g) ?? []).length).toBe(1);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("@import");
    expect(html).not.toMatch(/https?:\/\/[^"]*\.(css|js|woff2?|ttf)/);
  });

  it("bakes literal CSS values with no custom properties or external urls", () => {
    const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(style).not.toContain("var(");
    expect(style).not.toContain("url(");
    expect(style).not.toContain("@import");
    expect(style).not.toMatch(/@font-face/);
  });
});

describe("markdownToHtml fragment mode", () => {
  const fragment = markdownToHtml(SAMPLE, { standalone: false });

  it("omits the document scaffold", () => {
    expect(fragment).not.toContain("<!DOCTYPE");
    expect(fragment).not.toContain("<html");
    expect(fragment).not.toContain("<head");
    expect(fragment).not.toContain("<style");
    expect(fragment).not.toContain("<main");
  });

  it("starts with rendered content", () => {
    expect(fragment.trim().startsWith("<h1")).toBe(true);
  });
});

describe("markdownToHtml content rendering", () => {
  const fragment = markdownToHtml(SAMPLE, { standalone: false });

  it("gives headings slug ids", () => {
    expect(fragment).toContain('<h1 id="title-heading">');
    expect(fragment).toContain('<h2 id="section-two">');
  });

  it("renders GFM tables", () => {
    expect(fragment).toContain("<table>");
    expect(fragment).toContain("<th>Name</th>");
    expect(fragment).toContain("<td>Ada</td>");
  });

  it("renders task lists with checkbox state", () => {
    const checkboxes = fragment.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes.length).toBe(2);
    expect(checkboxes.filter((box) => box.includes("checked")).length).toBe(1);
  });

  it("renders code fences inside pre/code", () => {
    expect(fragment).toMatch(/<pre><code[^>]*>const value = 1;/);
  });

  it("renders blockquotes", () => {
    expect(fragment).toContain("<blockquote>");
  });

  it("renders strikethrough", () => {
    expect(fragment).toContain("<del>struck</del>");
  });
});

describe("markdownToHtml link policy", () => {
  const fragment = markdownToHtml(
    "[ext](https://example.com) [proto](//cdn.example.com/x) [anchor](#top) [repo](../README.md) [empty]()",
    { standalone: false },
  );

  it("keeps external links active and opens them safely in a new tab", () => {
    expect(fragment).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">ext</a>',
    );
  });

  it("normalizes protocol-relative links to https", () => {
    expect(fragment).toContain('href="https://cdn.example.com/x"');
  });

  it("keeps pure hash anchors active", () => {
    expect(fragment).toContain('<a href="#top">anchor</a>');
  });

  it("disables repo-relative links without a tooltip wrapper", () => {
    expect(fragment).toContain(
      '<a class="markdown-disabled-link" aria-disabled="true" data-original-href="../README.md">repo</a>',
    );
    expect(fragment).not.toContain("markdown-disabled-link-group");
    expect(fragment).not.toContain("markdown-disabled-link-tooltip");
  });

  it("disables empty hrefs with no original href", () => {
    expect(fragment).toMatch(
      /<a class="markdown-disabled-link" aria-disabled="true">empty<\/a>/,
    );
  });
});

describe("markdownToHtml safety guards", () => {
  it("does not emit live script tags from raw HTML input", () => {
    const fragment = markdownToHtml("<script>alert(1)</script>\n\ntext", {
      standalone: false,
    });
    expect(fragment).not.toContain("<script");
  });

  it("strips residual images instead of inlining or fetching them", () => {
    const fragment = markdownToHtml("![alt](https://example.com/cat.png)", {
      standalone: false,
    });
    expect(fragment).not.toContain("<img");
    expect(fragment).not.toContain("example.com/cat.png");
  });
});
