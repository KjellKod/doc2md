import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FileEntry } from "../types";
import PreviewPanel from "../components/PreviewPanel";
import { markdownToHtml } from "./markdownToHtml";

// Parity guard (build backlog BL-1 / arb-it1-1).
//
// One shared RAW fixture is fed through BOTH render paths:
//   - Preview mode (PreviewPanel -> PreviewMode -> react-markdown), which is
//     what users see on screen.
//   - markdownToHtml(fixture, { standalone: false }), the export renderer.
//
// Both paths MUST apply formatPreviewMarkdown as their first content step
// (PreviewMode via formatPreviewMarkdownWithLineMap, the export renderer
// explicitly). If they diverge, the structural assertions below fail.
//
// We normalize away allowed editor-only / export-only differences before
// comparing:
//   - data-source-line attributes (editor-only line map)
//   - find-highlight wrappers and ids the editor adds
//   - the disabled-link tooltip wrapper span + its event-only treatment
//   - the export-only data-original-href attribute
// What we DO compare is load-bearing: heading text + ids, table structure,
// task-list checkbox state, code/pre structure, blockquote structure, visible
// text, and link classification (active vs disabled).

const RAW_FIXTURE = `# Parity Heading

A paragraph with **bold**, _italic_, and \`inline code\`.

## Second Section

- [ ] open task
- [x] done task

| Name | Score | Done |
| ---- | ----- | ---- |
| Ada  | 10    | - [x] |
| Bob  | 7     | - [ ] |

> Quoted line.

\`\`\`ts
const parity = true;
\`\`\`

[External](https://example.com) then [Anchor](#second-section) then [Repo](../README.md).
`;

function createEntry(): FileEntry {
  return {
    id: "parity-1",
    file: new File([""], "parity.md"),
    name: "parity.md",
    format: "md",
    status: "success",
    markdown: RAW_FIXTURE,
    warnings: [],
    selected: true,
  };
}

interface NormalizedDoc {
  headings: { level: string; id: string; text: string }[];
  tableCells: string[];
  tableHeaders: string[];
  checkboxes: boolean[];
  codeText: string[];
  blockquotes: string[];
  links: { kind: "active" | "disabled"; text: string }[];
  text: string;
}

function normalizeText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripEditorOnlyNodes(root: ParentNode): ParentNode {
  // Clone so we never mutate the live Preview DOM, then drop the editor-only
  // disabled-link tooltip wrapper text. The tooltip span is a Preview-only
  // affordance (the export file is inert and has no tooltip); its text must
  // not count as content drift.
  const clone = (root as HTMLElement).cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(".markdown-disabled-link-tooltip")
    .forEach((node) => node.remove());
  return clone;
}

function proseText(root: ParentNode): string {
  // textContent over a <table> serializes cells with no separators in Preview
  // (no inter-cell whitespace text nodes) but with collapsed-whitespace gaps
  // in the export string. Table content is asserted structurally elsewhere,
  // so remove tables before comparing the prose flow to avoid a meaningless
  // whitespace mismatch.
  const clone = (root as HTMLElement).cloneNode(true) as HTMLElement;
  clone.querySelectorAll("table").forEach((node) => node.remove());
  return normalizeText(clone.textContent);
}

function normalize(input: ParentNode): NormalizedDoc {
  const root = stripEditorOnlyNodes(input);
  const headings = Array.from(
    root.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ).map((el) => ({
    level: el.tagName.toLowerCase(),
    id: el.id,
    text: normalizeText(el.textContent),
  }));

  const tableHeaders = Array.from(root.querySelectorAll("th")).map((el) =>
    normalizeText(el.textContent),
  );
  const tableCells = Array.from(root.querySelectorAll("td")).map((el) =>
    normalizeText(el.textContent),
  );

  const checkboxes = Array.from(
    root.querySelectorAll('input[type="checkbox"]'),
  ).map((el) => (el as HTMLInputElement).checked);

  const codeText = Array.from(root.querySelectorAll("pre code")).map((el) =>
    normalizeText(el.textContent),
  );

  const blockquotes = Array.from(root.querySelectorAll("blockquote")).map((el) =>
    normalizeText(el.textContent),
  );

  const links = Array.from(root.querySelectorAll("a")).map((el) => {
    const isDisabled =
      el.getAttribute("aria-disabled") === "true" || !el.hasAttribute("href");
    return {
      kind: (isDisabled ? "disabled" : "active") as "active" | "disabled",
      text: normalizeText(el.textContent),
    };
  });

  return {
    headings,
    tableHeaders,
    tableCells,
    checkboxes,
    codeText,
    blockquotes,
    links,
    text: proseText(root),
  };
}

afterEach(() => {
  cleanup();
});

describe("export/Preview parity guard", () => {
  it("renders structurally equivalent content from one shared fixture", () => {
    const { container } = render(<PreviewPanel entry={createEntry()} />);
    const previewSurface = container.querySelector(".markdown-surface");
    expect(previewSurface).not.toBeNull();

    const exportFragment = markdownToHtml(RAW_FIXTURE, { standalone: false });
    const exportRoot = document.createElement("div");
    exportRoot.innerHTML = exportFragment;

    const preview = normalize(previewSurface!);
    const exported = normalize(exportRoot);

    // Sanity: the fixture is non-trivial, so the comparison is load-bearing
    // rather than a tautology over empty collections.
    expect(preview.headings.length).toBeGreaterThanOrEqual(2);
    // 2 list-item task checkboxes + 2 synthesized table-cell checkboxes.
    expect(preview.checkboxes.length).toBe(4);
    expect(preview.links.length).toBe(3);

    expect(exported.headings).toEqual(preview.headings);
    expect(exported.tableHeaders).toEqual(preview.tableHeaders);
    expect(exported.tableCells).toEqual(preview.tableCells);
    expect(exported.checkboxes).toEqual(preview.checkboxes);
    expect(exported.codeText).toEqual(preview.codeText);
    expect(exported.blockquotes).toEqual(preview.blockquotes);
    expect(exported.links).toEqual(preview.links);
    expect(exported.text).toEqual(preview.text);
  });

  it("classifies the disabled repo-relative link the same way in both paths", () => {
    const { container } = render(<PreviewPanel entry={createEntry()} />);
    const previewSurface = container.querySelector(".markdown-surface")!;
    const exportRoot = document.createElement("div");
    exportRoot.innerHTML = markdownToHtml(RAW_FIXTURE, { standalone: false });

    const previewRepo = Array.from(previewSurface.querySelectorAll("a")).find(
      (el) => normalizeText(el.textContent) === "Repo",
    );
    const exportRepo = Array.from(exportRoot.querySelectorAll("a")).find(
      (el) => normalizeText(el.textContent) === "Repo",
    );

    // Same classification: both paths mark the repo-relative link disabled.
    expect(previewRepo?.getAttribute("aria-disabled")).toBe("true");
    expect(exportRepo?.getAttribute("aria-disabled")).toBe("true");
    expect(previewRepo?.className).toContain("markdown-disabled-link");
    expect(exportRepo?.className).toContain("markdown-disabled-link");

    // Preview keeps the original href live (with JS click/key guards) so
    // right-click "Copy Link" works in the editor; the export file is inert
    // and has no JS, so it carries the original href as a data attribute
    // instead. Both are non-navigable; only the carrier attribute differs.
    expect(previewRepo?.getAttribute("href")).toBe("../README.md");
    expect(exportRepo?.getAttribute("href")).toBeNull();
    expect(exportRepo?.getAttribute("data-original-href")).toBe("../README.md");
  });
});
