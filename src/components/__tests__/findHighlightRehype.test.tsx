import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findHighlightRehype, type RenderedFindMatch } from "../findHighlightRehype";
import { deriveRenderedText } from "../preview/renderedTextCorpus";

function renderMarkdown(markdown: string, match: RenderedFindMatch | null) {
  return render(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[findHighlightRehype(match)]}
    >
      {markdown}
    </ReactMarkdown>,
  );
}

function plainText(markdown: string): string {
  const { container, unmount } = renderMarkdown(markdown, null);
  const text = container.textContent ?? "";
  unmount();
  return text;
}

describe("findHighlightRehype", () => {
  it("does not insert <mark> when match is null", () => {
    const { container } = renderMarkdown("plain text", null);
    expect(
      container.querySelectorAll("mark.markdown-rendered-find-highlight").length,
    ).toBe(0);
    expect(container.textContent).toContain("plain text");
  });

  it("wraps a single text node match", () => {
    const md = "alpha beta gamma";
    const text = plainText(md);
    const start = text.indexOf("beta");
    const { container } = renderMarkdown(md, { start, end: start + 4 });
    const marks = container.querySelectorAll(
      "mark.markdown-rendered-find-highlight",
    );
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("beta");
    // Text content unchanged.
    expect(container.textContent).toBe(text);
  });

  it("handles a match crossing an emphasis boundary without duplicating <strong>", () => {
    const md = "before **alpha bravo** after";
    const text = plainText(md);
    expect(text).toBe("before alpha bravo after");
    const start = text.indexOf("alpha");
    const end = text.indexOf(" after") + 2;
    const { container } = renderMarkdown(md, { start, end });
    // <strong> count preserved — the core Bug 2 invariant.
    expect(container.querySelectorAll("strong").length).toBe(1);
    // At least one <mark> present.
    expect(
      container.querySelectorAll("mark.markdown-rendered-find-highlight")
        .length,
    ).toBeGreaterThanOrEqual(1);
    // Visible characters unchanged.
    expect(container.textContent).toBe(text);
  });

  it("wraps matched text inside a link", () => {
    const md = "see [click here](https://example.com) please";
    const text = plainText(md);
    expect(text).toBe("see click here please");
    const start = text.indexOf("click");
    const { container } = renderMarkdown(md, { start, end: start + 5 });
    const marks = container.querySelectorAll(
      "mark.markdown-rendered-find-highlight",
    );
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("click");
    // <a> still intact.
    expect(container.querySelector('a[href="https://example.com"]')).not.toBeNull();
    expect(container.textContent).toBe(text);
  });

  it("treats HTML entities as single rendered characters", () => {
    const md = "a &amp; b";
    const text = plainText(md);
    expect(text).toBe("a & b");
    const start = text.indexOf("& b");
    const { container } = renderMarkdown(md, { start, end: start + 3 });
    const marks = container.querySelectorAll(
      "mark.markdown-rendered-find-highlight",
    );
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("& b");
    expect(container.textContent).toBe(text);
  });

  it("inserts a zero-width caret marker at offset 0 (start of document)", () => {
    const md = "hello world";
    const { container } = renderMarkdown(md, { start: 0, end: 0 });
    const zeroMark = container.querySelector(
      "mark.markdown-rendered-find-highlight-zero",
    );
    expect(zeroMark).not.toBeNull();
    // The plain text still contains "hello world".
    expect(container.textContent).toContain("hello world");
  });

  it("inserts a zero-width caret marker at end-of-document offset", () => {
    const md = "hello world";
    const text = plainText(md);
    const { container } = renderMarkdown(md, {
      start: text.length,
      end: text.length,
    });
    expect(
      container.querySelector("mark.markdown-rendered-find-highlight-zero"),
    ).not.toBeNull();
  });

  it("preserves <strong>/<em> structure across all match positions in a mixed-emphasis doc", () => {
    // This is the structural invariant Bug 2 was about.
    const md =
      "Plain alpha here. Bold **alpha bravo** more. Italic _alpha_ end.";
    const text = plainText(md);
    const occurrences: number[] = [];
    let i = text.indexOf("alpha");
    while (i !== -1) {
      occurrences.push(i);
      i = text.indexOf("alpha", i + 1);
    }
    expect(occurrences.length).toBe(3);

    for (const start of occurrences) {
      const { container, unmount } = renderMarkdown(md, {
        start,
        end: start + 5,
      });
      expect(
        container.querySelectorAll("strong").length,
        `<strong> count for match at offset ${start}`,
      ).toBe(1);
      expect(
        container.querySelectorAll("em").length,
        `<em> count for match at offset ${start}`,
      ).toBe(1);
      expect(
        container.textContent,
        `text content for match at offset ${start}`,
      ).toBe(text);
      unmount();
    }
  });

  it("wraps adjacent-cell matches when corpus injects td-boundary separators", () => {
    // Bug fix for ideas/bug_report_find_preview_table_cells.md.
    // Pre-fix corpus was element.textContent which concatenates cells
    // with no separator ("AtlasJordan"). Post-fix corpus emits a
    // virtual space at <td> close ("Atlas Jordan"). The same
    // separator rule lives in findHighlightRehype's walk so offsets
    // stay coherent across the two pipelines.
    const md = [
      "| Project | Owner |",
      "| --- | --- |",
      "| Atlas | Jordan |",
    ].join("\n");

    const { container: corpusContainer, unmount: unmountCorpus } =
      renderMarkdown(md, null);
    const corpus = deriveRenderedText(corpusContainer as HTMLElement);
    unmountCorpus();

    // Sanity: corpus places a space between adjacent cells.
    expect(corpus).toContain("Atlas Jordan");
    const start = corpus.indexOf("Atlas Jordan");
    expect(start).toBeGreaterThanOrEqual(0);

    const { container } = renderMarkdown(md, {
      start,
      end: start + "Atlas Jordan".length,
    });
    const marks = container.querySelectorAll(
      "mark.markdown-rendered-find-highlight",
    );
    // One <mark> per cell — the matched span crosses a td boundary,
    // so the rendered DOM has two adjacent marks (one in each cell).
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("Atlas");
    expect(marks[1].textContent).toBe("Jordan");
  });

  it("keeps rendered offsets aligned inside fenced XML code blocks", () => {
    const md = [
      "# Launch Agent",
      "",
      "Inspect the generated plist:",
      "",
      "```xml",
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<plist version=\"1.0\">",
      "<dict>",
      "  <key>Label</key>",
      "  <string>com.example.agent</string>",
      "  <key>RunAtLoad</key>",
      "  <true/>",
      "</dict>",
      "</plist>",
      "```",
    ].join("\n");

    const { container: corpusContainer, unmount: unmountCorpus } =
      renderMarkdown(md, null);
    const corpus = deriveRenderedText(corpusContainer as HTMLElement);
    unmountCorpus();

    const start = corpus.indexOf("RunAtLoad");
    expect(start).toBeGreaterThanOrEqual(0);

    const { container } = renderMarkdown(md, {
      start,
      end: start + "RunAtLoad".length,
    });
    const marks = container.querySelectorAll(
      "mark.markdown-rendered-find-highlight",
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("RunAtLoad");
  });
});
