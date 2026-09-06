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

function largeTableMarkdown(rowCount = 1_100): string {
  const rows = ["# Report", "", "| Package | License | Notes |", "| --- | --- | --- |"];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push(`| package-${index} | MIT | ${"metadata ".repeat(8)} |`);
  }
  return rows.join("\n");
}

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

  it("exports large table-heavy Markdown as rendered document HTML", () => {
    const fragment = markdownToHtml(
      `${largeTableMarkdown()}\n<script>alert(1)</script>`,
      { standalone: false },
    );

    expect(fragment).not.toContain("Rich table rendering skipped");
    expect(fragment).toContain("<table>");
    expect(fragment).toContain("<th>Package</th>");
    expect(fragment).toContain("<td>package-0</td>");
    expect(fragment).not.toContain("<script");
    expect(fragment).not.toContain("alert(1)");
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

describe("markdownToHtml safe raw HTML anchors", () => {
  it("renders an explicit target and rewrites its fragment link", () => {
    const fragment = markdownToHtml(
      '[Jump](#7-2-prove-the-ci-commercial-dmg-build-path)\n\n<a id="7-2-prove-the-ci-commercial-dmg-build-path"></a>\n\n### 7.2 Prove the CI commercial DMG build path',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = fragment;

    expect(
      root.querySelector('[id="7-2-prove-the-ci-commercial-dmg-build-path"]'),
    ).toBeNull();
    const target = root.querySelector(
      '[id="user-content:7-2-prove-the-ci-commercial-dmg-build-path"]',
    );
    expect(target).not.toBeNull();
    expect(target?.hasAttribute("href")).toBe(false);
    expect(
      root.querySelector(
        'a[href="#user-content:7-2-prove-the-ci-commercial-dmg-build-path"]',
      )?.textContent,
    ).toBe("Jump");
  });

  it("keeps explicit targets separate from headings and suffixes duplicates", () => {
    const fragment = markdownToHtml(
      '[Explicit](#foo) [Heading](#user-content-foo)\n\n<a id="foo"></a>\n\n<a id="foo"></a>\n\n### Foo\n\n### User Content Foo',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = fragment;
    const ids = Array.from(root.querySelectorAll("[id]"), (node) => node.id);
    expect(ids).toContain("user-content:foo");
    expect(ids).toContain("user-content:foo-1");
    expect(ids).toContain("foo");
    expect(ids).toContain("user-content-foo");
    expect(new Set(ids).size).toBe(ids.length);
    expect(root.querySelector('a[href="#user-content:foo"]')?.textContent).toBe("Explicit");
    expect(root.querySelector('a[href="#user-content-foo"]')?.textContent).toBe("Heading");
  });

  it("does not double-prefix normalized ids or crash on malformed fragments", () => {
    const fragment = markdownToHtml(
      '<a id="user-content:ready"></a>\n\n[Ready](#user-content%3Aready) [Malformed](#%ZZ)',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = fragment;
    expect(root.querySelector('[id="user-content:ready"]')).not.toBeNull();
    expect(root.querySelector('[id="user-content:user-content:ready"]')).toBeNull();
    expect(root.querySelector('a[href="#user-content:ready"]')?.textContent).toBe("Ready");
    expect(root.querySelector('a[href="#%ZZ"]')?.textContent).toBe("Malformed");
  });

  it("preserves literal percent sequences when rewriting fragment links", () => {
    const fragment = markdownToHtml(
      '[Jump](#a%2520b)\n\n<a id="a%20b"></a>',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = fragment;

    expect(root.querySelector('[id="user-content:a%20b"]')).not.toBeNull();
    expect(root.querySelector('a[href="#user-content:a%2520b"]')?.textContent).toBe(
      "Jump",
    );
  });

  it("preserves real footnotes and rejects forged generated identity", () => {
    const fragment = markdownToHtml(
      'Note[^1]\n\n<a id="user-content-fn-1" data-footnote-ref>Forged</a>\n\n[^1]: Real footnote',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = fragment;
    const reference = root.querySelector("a[data-footnote-ref]");
    const definition = root.querySelector('li[id="user-content-fn-1"]');
    const backReference = root.querySelector('a[data-footnote-backref]');
    expect(reference?.id).toBe("user-content-fnref-1");
    expect(reference?.getAttribute("href")).toBe("#user-content-fn-1");
    expect(reference?.getAttribute("aria-describedby")).toBe("footnote-label");
    expect(definition?.textContent).toContain("Real footnote");
    expect(backReference?.getAttribute("href")).toBe("#user-content-fnref-1");
    expect(backReference?.classList.contains("data-footnote-backref")).toBe(true);
    expect(root.querySelector("section.footnotes[data-footnotes]")).not.toBeNull();
    expect(root.querySelector('[id="user-content:user-content-fn-1"]')?.textContent).toBe("Forged");
  });

  it("rewrites allowed ARIA references to normalized author ids", () => {
    const fragment = markdownToHtml(
      '<h2 id="label">Label</h2><table aria-labelledby="label"><tr><td>Cell</td></tr></table>',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = fragment;
    expect(root.querySelector('[id="user-content:label"]')).not.toBeNull();
    expect(root.querySelector("table")?.getAttribute("aria-labelledby")).toBe("user-content:label");
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

  it("keeps Markdown and raw tel links active with safe attributes", () => {
    const telFragment = markdownToHtml(
      '[Markdown](tel:+15555550123) <a href="tel:+15555550123">Raw</a>',
      { standalone: false },
    );
    const root = document.createElement("div");
    root.innerHTML = telFragment;
    expect(root.querySelectorAll('a[href="tel:+15555550123"]')).toHaveLength(2);
    root.querySelectorAll('a[href="tel:+15555550123"]').forEach((anchor) => {
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
    });
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
  it("keeps hostile raw HTML out of the standalone document", () => {
    const html = markdownToHtml(
      '<style>.author-style{color:red}</style><picture><source srcset="https://example.com/tracker.png"><img src="https://example.com/fallback.png"></picture><a id="target" tabindex="0" accesskey="k" onclick="alert(1)"></a>',
    );
    const root = document.createElement("div");
    root.innerHTML = html;

    expect(root.querySelectorAll("style")).toHaveLength(1);
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("example.com");
    const target = root.querySelector('[id="user-content:target"]');
    expect(target?.hasAttribute("tabindex")).toBe(false);
    expect(target?.hasAttribute("accesskey")).toBe(false);
    expect(target?.hasAttribute("onclick")).toBe(false);
  });

  it("does not emit live script tags from raw HTML input", () => {
    const fragment = markdownToHtml("<script>alert(1)</script>\n\ntext", {
      standalone: false,
    });
    expect(fragment).not.toContain("<script");
  });

  it("renders safe raw HTML and unwraps benign non-allowlisted containers", () => {
    const fragment = markdownToHtml(
      'Before <span data-x="1">INNERTEXT</span> after.\n\n<div class="block">BLOCKTEXT</div>',
      { standalone: false },
    );
    expect(fragment).toContain("<span>INNERTEXT</span>");
    expect(fragment).not.toContain("<div");
    expect(fragment).toContain("INNERTEXT");
    expect(fragment).toContain("BLOCKTEXT");
  });

  it("removes executable raw HTML with its contents", () => {
    const fragment = markdownToHtml(
      "<script>script text</script><style>style text</style><iframe>frame text</iframe><form>form text</form><object>object text</object><embed>",
      { standalone: false },
    );
    expect(fragment).not.toMatch(/script|style|iframe|form|object|embed|text/iu);
  });

  it("removes dangerous raw attributes and URL schemes", () => {
    const fragment = markdownToHtml(
      '<a href="javascript:alert(1)" onclick="alert(1)" style="color:red" name="legacy" ping="https://tracker.example">unsafe</a>',
      { standalone: false },
    );
    expect(fragment).not.toContain("javascript:");
    expect(fragment).not.toContain("onclick");
    expect(fragment).not.toContain("style=");
    expect(fragment).not.toContain("name=");
    expect(fragment).not.toContain("ping=");
    expect(fragment).toContain("markdown-disabled-link");
  });

  it("removes raw picture source trees and every external image source", () => {
    const fragment = markdownToHtml(
      '<picture><source srcset="https://example.com/tracker.png"><img src="https://example.com/fallback.png"></picture>',
      { standalone: false },
    );
    expect(fragment).not.toMatch(/picture|source|img|srcset/iu);
    expect(fragment).not.toContain("example.com");
  });

  it("strips residual images instead of inlining or fetching them", () => {
    const fragment = markdownToHtml("![alt](https://example.com/cat.png)", {
      standalone: false,
    });
    expect(fragment).not.toContain("<img");
    expect(fragment).not.toContain("example.com/cat.png");
  });

  it("keeps a remote https:// image out of the standalone document so it stays self-contained", () => {
    // Remote-image guard (BL-5): a self-contained export must carry no remote
    // references. The renderer drops the image entirely rather than emitting
    // an <img src="https://..."> that would fetch over the network.
    const html = markdownToHtml(
      "# Title\n\nBefore ![remote](https://cdn.example.com/photo.jpg) after.",
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("cdn.example.com/photo.jpg");
    expect(html).not.toMatch(/src="https?:\/\//);
    // Surrounding prose survives.
    expect(html).toContain("Before");
    expect(html).toContain("after.");
  });
});
