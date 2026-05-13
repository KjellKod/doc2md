# Bug Report: Find in Preview Mode Loses Table Cell Boundaries

## Status

Pre-existing. Not introduced by PR #120 (npm-development bump) or PR #119 (npm-production bump). Reproduces against `main` at the time of writing. Filed during PR #120's manual smoke validation.

## Symptom

When the user opens an `.xlsx` or `.csv` file (or any source that converts to a markdown table) and toggles to **Preview** mode:

- Single-cell substring queries match correctly. `Dulce`, `United States`, `First Name` all light up.
- Multi-cell queries — anything that includes a space the user expects between two cell values — fail to match anything.

The same multi-cell queries match correctly in **Edit** mode, because the Edit corpus is the raw markdown source where cells are separated by ` | ` and rows by `\n`.

User-reported example (fixture: `file_example_XLSX_10.xlsx`, a 10-row payroll-style table):

- Edit mode, search `Dulce Abril`: **1 of 1**.
- Preview mode, search `Dulce Abril`: **0 matches**.
- Edit mode, search `Female 32`: matches several rows.
- Preview mode, search `Female 32`: no matches.

## Root cause

`src/components/PreviewPanel.tsx:547` derives the preview find corpus from the rendered DOM:

```ts
const nextText = (element.textContent ?? "").replace(/​/g, "");
setRenderedViewText(...);
```

For a markdown table, the rendered HTML is `<table><tr><td>…</td><td>…</td></tr>…</table>`. The `Node.textContent` spec concatenates **all descendant text nodes with no separator at element boundaries**. So for a single row `| Dulce | Abril | Female | United States | 32 | 15/10/2017 |`, the textContent fragment becomes:

```
DulceAbrilFemaleUnited States3215/10/2017
```

This corpus is what `useFindReplace` searches against (`activeFindSource` at `PreviewPanel.tsx:526-527`). The user types `Dulce Abril`; the literal substring search finds no match because the rendered corpus is `DulceAbril`. The match offsets the rehype plugin (`findHighlightRehype`) consumes are also computed against this corpus, so cross-cell highlights cannot be produced even hypothetically.

## Confirmation

A Playwright probe (one-shot, removed after measurement) against PR #120's HEAD:

```
preview <table> count: 1
preview <ul>/<ol> count: 0
preview <tr> count: 10
preview textContent head: "Previewtable.xlsxEditPreviewLinkedIn…Sheet: Sheet1\n0First NameLast NameGenderCountryAgeDateId1DulceAbrilFemaleUnited States3215/10/20171562…"
```

Note `0First NameLast Name…` — no separator between cell `0` and cell `First Name`, no separator between `Female`+`United States`, no separator between `32`+`15/10/2017`.

## User-visible impact

- Anyone converting an `.xlsx` or `.csv` to Markdown and using Find/Replace in Preview mode will silently fail to locate multi-cell values that they *can* see in the rendered table.
- Edit mode is a workaround, but it surfaces the raw `| pipe | delimited |` form which is harder to scan visually than the rendered table.
- Same issue applies in principle to any other markdown construct whose DOM rendering has no inter-element whitespace and where users naturally expect a space (e.g., adjacent inline elements `<sup>1</sup><sup>2</sup>` → `12` in textContent; potential issue with list items in some renderers, though `<li>` typically does include the visible content as a contiguous text run).

## Why this is not caught by existing tests

- `tests/e2e/dep-bump-format-smoke.spec.ts` exercises Find/Replace but only against a single-line markdown body where cell boundaries do not exist.
- The unit tests in `src/components/__tests__/findHighlightRehype.test.tsx` cover hast-tree walking for inline emphasis, links, HTML entities, zero-width — but not table cells.
- The fixture used for xlsx coverage (`test-fixtures/sample.xlsx`) only checks conversion correctness via `result.markdown.toContain("...")` — it does not exercise find-in-preview at all.

## Proposed fix direction

The corpus computation must inject a separator at HTML element boundaries that visually represent a break. Two viable approaches:

1. **Custom DOM walk** that emits a single space at the close of `<td>`, `<th>`, `<dt>`, `<dd>`, `<li>`, and a newline at the close of `<tr>`, `<p>`, `<div>`, `<br>`, headings, list items. Computed once per render of the surface and stored as `renderedViewText`.

2. **Inject zero-width separator markers via rehype** during the markdown-to-hast pass, then strip them from the *visible* DOM via CSS (`position: absolute; user-select: none`) but keep them in `textContent`. Higher implementation cost; gives offsets-stable behavior.

Option 1 is the lower-risk first step. The match offsets in `findHighlightRehype` already work in rendered-text-offset space, so changing what counts as a character in that space requires keeping the hast walk and the corpus walk in sync. The hast walk in `findHighlightRehype.ts` already knows what elements are being descended into; adding an "insert virtual space on close of `<td>` / newline on close of `<tr>`" rule there in tandem with the corpus computation would keep offsets coherent.

## Acceptance criteria for a future fix

1. In Preview mode, `Find` of `Dulce Abril` against `file_example_XLSX_10.xlsx` reports `1 of 1` (matches the user's edit-mode behavior).
2. In Preview mode, `Find` of `Female 32` against the same fixture matches every row where those values appear in adjacent columns.
3. Existing single-cell match behavior (`Dulce`, `United States`, `First Name`) continues to match exactly once each.
4. Cross-emphasis matches inside running text (the case `findHighlightRehype.test.tsx` covers) continue to work.
5. The `<mark>` highlights land on the correct visible cells, not shifted by the virtual separator characters.
6. A new e2e spec (`tests/e2e/find-table-cells.spec.ts`) uses a real xlsx fixture and asserts both edit-mode and preview-mode counts match for at least four queries: single-cell substring, cross-cell-boundary phrase, header text, numeric value adjacent to another numeric value.

## Reproduction artifact

A user-supplied 10-row fixture exists at `.ws/file_example_XLSX_10.xlsx`. Public mirror: any xlsx with at least 2 columns and 2 rows reproduces this — the bug is structural.

## Cross-references

- PR #123 reworked the preview-find rendering pipeline to a rehype plugin (`findHighlightRehype.ts`) and replaced direct DOM mutation. Companion bug reports for that work are at `ideas/archive/bug_report_find_match_scrolls_to_wrong_line.md` and `ideas/archive/bug_report_find_highlight_dom_leaks.md`. This bug is a separate corpus-derivation concern that the rehype rework did not address.
- The xlsx markdown output is produced by `src/converters/xlsx.ts` and `src/converters/delimited.ts` (`renderMarkdownTable`). The output is well-formed GFM — the bug is downstream in how the rendered HTML is collapsed into a searchable string.
