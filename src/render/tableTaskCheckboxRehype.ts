// Shared rehype synthesis plugin: turns leading task-list markers inside GFM
// table cells (`- [ ]`, `[x]`, ...) into static <input type="checkbox" disabled>
// nodes, in BOTH the export pipeline (markdownToHtml) and the Preview pipeline
// (PreviewMode). Synthesis is purely additive and identical in both paths, so
// preview/export parity holds by construction (plan §4.1).
//
// Convertibility is decided on RAW SOURCE via the canonical module
// (tableCellCheckbox.ts), never on decoded HAST — escaped `\[ \]` stays literal.
// The plugin resolves each row's raw source line through a caller-supplied
// resolver (export and preview supply different resolvers, plan §4.1), runs the
// canonical enumerator, and applies a raw-cell-count vs DOM-cell-count fail-safe:
// if they disagree (e.g. a pipe inside inline code), the whole row is left
// literal rather than risk a wrong-cell mapping (plan §4.1 step 2).
//
// Preview-only interactivity attributes (data-task-source-line, aria-label) are
// NOT added here; sourceLineRehype stamps those in the Preview pipeline only.

import type { Element, ElementContent, Root, Text } from "hast";
import type { Plugin } from "unified";
import {
  enumerateRowMarkers,
  type CellMarker,
} from "../components/preview/tableCellCheckbox";

export interface TableTaskCheckboxOptions {
  /**
   * Resolve the raw source line for a table row given its 1-based HAST start
   * line. Return null when no usable source line exists (then the row is left
   * literal). Export and Preview supply intentionally different resolvers.
   */
  resolveRowSourceLine: (rowStartLine: number) => string | null;
}

function isElement(node: ElementContent): node is Element {
  return node.type === "element";
}

function rowStartLine(row: Element): number | null {
  // Prefer the row's own position; fall back to the first cell's position.
  const own = row.position?.start?.line;
  if (typeof own === "number" && own >= 1) {
    return own;
  }
  for (const child of row.children) {
    if (isElement(child)) {
      const cellLine = child.position?.start?.line;
      if (typeof cellLine === "number" && cellLine >= 1) {
        return cellLine;
      }
    }
  }
  return null;
}

function makeCheckboxInput(marker: CellMarker): Element {
  return {
    type: "element",
    tagName: "input",
    properties: {
      type: "checkbox",
      // Mirror GFM's static task-list inputs. Preview re-enables only inputs it
      // also stamps with data-task-source-line; export keeps them static.
      disabled: true,
      checked: marker.state === "checked",
      "data-task-marker-index": String(marker.markerIndex),
    },
    children: [],
  };
}

/**
 * Replace the leading marker text in a DOM cell with an <input>, preserving any
 * trailing label text. The cell's first text node holds the (decoded) cell
 * content; we strip the marker prefix from it. The raw-source enumerator has
 * already decided this cell is convertible, so the leading marker form is
 * guaranteed present in the decoded text too (decoding only removes backslashes
 * from escaped brackets, which are non-markers and never reach this path).
 */
function convertCell(cell: Element, marker: CellMarker): boolean {
  const firstText = cell.children.find(
    (child): child is Text => child.type === "text",
  );
  if (!firstText) {
    return false;
  }

  const value = firstText.value;
  const leadingWhitespace = value.length - value.trimStart().length;
  const afterWhitespace = value.slice(leadingWhitespace);

  // Match the leading marker in the decoded text: optional bullet + `[ ]`-style
  // brackets. Mirrors the canonical recognition forms.
  const markerMatch = /^(?:[-*+][ \t]+)?\[(?: |x|X)\]/u.exec(afterWhitespace);
  if (!markerMatch) {
    return false;
  }

  const remainder = afterWhitespace.slice(markerMatch[0].length);
  const inputNode = makeCheckboxInput(marker);
  const replacement: ElementContent[] = [inputNode];

  // Preserve the leading whitespace (if any) before the input so cell padding
  // is not silently dropped, then the trailing label after the marker.
  if (leadingWhitespace > 0) {
    replacement.unshift({ type: "text", value: value.slice(0, leadingWhitespace) });
  }
  if (remainder.length > 0) {
    replacement.push({ type: "text", value: remainder });
  }

  const textIndex = cell.children.indexOf(firstText);
  cell.children.splice(textIndex, 1, ...replacement);
  return true;
}

function processRow(
  row: Element,
  options: TableTaskCheckboxOptions,
): void {
  const startLine = rowStartLine(row);
  if (startLine === null) {
    return;
  }

  const rawLine = options.resolveRowSourceLine(startLine);
  if (rawLine === null) {
    return;
  }

  const { markers, rawCellCount } = enumerateRowMarkers(rawLine);
  if (markers.length === 0) {
    return;
  }

  const cells = row.children.filter(
    (child): child is Element =>
      isElement(child) && (child.tagName === "td" || child.tagName === "th"),
  );

  // Alignment fail-safe: if the raw-split cell count disagrees with the DOM cell
  // count, the cell<->marker mapping is untrustworthy (e.g. a pipe inside inline
  // code). Skip the whole row, leaving it literal (plan §4.1 step 2).
  if (cells.length !== rawCellCount) {
    return;
  }

  for (const marker of markers) {
    const cell = cells[marker.cellIndex];
    if (cell) {
      convertCell(cell, marker);
    }
  }
}

function visitRows(node: Element, options: TableTaskCheckboxOptions): void {
  if (node.tagName === "tr") {
    processRow(node, options);
    return;
  }
  for (const child of node.children) {
    if (isElement(child)) {
      visitRows(child, options);
    }
  }
}

export function tableTaskCheckboxRehype(
  options: TableTaskCheckboxOptions,
): Plugin<[], Root> {
  return () => (tree: Root) => {
    for (const child of tree.children) {
      if (child.type === "element") {
        visitRows(child, options);
      }
    }
  };
}
