import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./markdownToHtml";

// These tests drive the shared synthesis plugin through the EXPORT pipeline
// (markdownToHtml). Export uses the same plugin as Preview, so the synthesis
// behavior asserted here is the parity baseline (plan §4.1).

function fragment(markdown: string): string {
  return markdownToHtml(markdown, { standalone: false });
}

function countCheckboxes(html: string): number {
  return (html.match(/<input[^>]*type="checkbox"/gu) ?? []).length;
}

describe("table-cell checkbox synthesis (export pipeline)", () => {
  it("synthesizes disabled checkbox inputs with correct state and marker index", () => {
    const html = fragment(
      ["| MARKED | Name |", "| --- | --- |", "| - [ ] | Kjell |", "| - [x] | Jane |"].join(
        "\n",
      ),
    );

    expect(countCheckboxes(html)).toBe(2);
    // Unchecked marker.
    expect(html).toMatch(
      /<input[^>]*type="checkbox"[^>]*disabled[^>]*data-task-marker-index="0"/u,
    );
    // Checked marker.
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked/u);
    // No preview-only write-back attrs leak into export.
    expect(html).not.toContain("data-task-source-line");
  });

  it("converts header <th> markers", () => {
    const html = fragment(
      ["| [ ] | Name |", "| --- | --- |", "| value | text |"].join("\n"),
    );
    expect(html).toMatch(/<th[^>]*>\s*<input[^>]*type="checkbox"/u);
  });

  it("assigns incrementing marker indices to multiple checkbox cells in one row", () => {
    const html = fragment(
      ["| A | B | C |", "| --- | --- | --- |", "| - [ ] | - [x] | - [ ] |"].join("\n"),
    );
    expect(countCheckboxes(html)).toBe(3);
    expect(html).toContain('data-task-marker-index="0"');
    expect(html).toContain('data-task-marker-index="1"');
    expect(html).toContain('data-task-marker-index="2"');
  });

  it("preserves trailing label text after a converted marker", () => {
    const html = fragment(
      ["| Task | x |", "| --- | --- |", "| - [x] Ship it | y |"].join("\n"),
    );
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*>\s*Ship it/u);
  });

  it("does not synthesize inputs for decoy cells", () => {
    const html = fragment(
      [
        "| A | B | C | D | E |",
        "| --- | --- | --- | --- | --- |",
        "| [x](https://example.com) | `[ ]` | \\[ \\] | done [x] | - [ ] |",
      ].join("\n"),
    );
    // Only the genuine `- [ ]` cell converts.
    expect(countCheckboxes(html)).toBe(1);
    expect(html).toContain('data-task-marker-index="0"');
    // The escaped marker stays literal text.
    expect(html).toContain("[ ]");
  });

  it("leaves genuine task lists outside tables on the existing path", () => {
    const html = fragment(["- [ ] outside", "- [x] done"].join("\n"));
    // remark-gfm already renders these; no data-task-marker-index is added.
    expect(html).not.toContain("data-task-marker-index");
    expect(countCheckboxes(html)).toBe(2);
  });

  it("produces no false positives in fenced code, delimiter rows, or thematic breaks", () => {
    const html = fragment(
      [
        "```",
        "| - [ ] | fenced |",
        "```",
        "",
        "---",
        "",
        "Just prose with - [ ] inline.",
      ].join("\n"),
    );
    expect(countCheckboxes(html)).toBe(0);
  });

  it("skips the whole row when a pipe inside a cell breaks cell alignment (fail-safe)", () => {
    // An unescaped `|` inside `` `a|b` `` makes the raw pipe-split over-count
    // cells versus the DOM <td> count remark-gfm produces, so the plugin leaves
    // the entire row literal rather than mis-map the marker onto the wrong cell
    // (arb-it1-5b, plan §4.1 step 2). A missed conversion is acceptable; a
    // wrong-cell mutation is not.
    const html = fragment(
      ["| A | B | C |", "| --- | --- | --- |", "| `a|b` | x | - [ ] |"].join("\n"),
    );
    expect(countCheckboxes(html)).toBe(0);
    expect(html).not.toContain("data-task-marker-index");
  });

  it("handles multiple tables independently with correct indices", () => {
    const html = fragment(
      [
        "| A |",
        "| --- |",
        "| - [ ] |",
        "",
        "| B |",
        "| --- |",
        "| - [x] |",
      ].join("\n"),
    );
    expect(countCheckboxes(html)).toBe(2);
  });
});

describe("export parity (arb-it1-4)", () => {
  it("renders disabled static checkboxes with no preview write-back attrs", () => {
    const html = fragment(
      ["| MARKED | Name |", "| --- | --- |", "| - [ ] | Kjell |", "| - [x] | Jane |"].join(
        "\n",
      ),
    );

    // Each marker becomes a disabled checkbox input.
    const disabledCheckboxes =
      html.match(/<input[^>]*type="checkbox"[^>]*disabled/gu) ?? [];
    expect(disabledCheckboxes.length).toBe(2);

    // None of the preview-only interactivity attributes appear in export.
    expect(html).not.toContain("data-task-source-line");
    expect(html).not.toContain("aria-label");
  });
});
