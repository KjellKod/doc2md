import type { Element, ElementContent, Root, RootContent } from "hast";

/**
 * A hand-rolled rehype plugin (no extra dependency) that stamps each
 * top-level block element with `data-source-line="N"`, where N is a
 * 1-based line number in the original (pre-formatting) markdown source.
 *
 * The plugin reads `node.position.start.line` (which mdast-util-to-hast
 * preserves from the parsed mdast tree) — that line number indexes the
 * formatted markdown that ReactMarkdown receives. We translate it back
 * to the original-source line via the caller-provided `originalLineFor`
 * map, where index = formatted line (0-based) and value = original line
 * (1-based). Defensive out-of-range lookups fall back to the formatted
 * line itself.
 *
 * Top-level elements get `data-source-line` for viewport anchoring. Task list
 * checkboxes also get `data-task-source-line` so rendered View checkboxes can
 * update the exact source marker without polluting the viewport anchor stamps.
 */
export function sourceLineRehype(originalLineFor: number[]) {
  return function plugin() {
    return function transformer(tree: Root) {
      for (const node of tree.children) {
        stamp(node, originalLineFor);
      }
    };
  };
}

function stamp(node: RootContent, originalLineFor: number[]) {
  if (node.type !== "element") {
    return;
  }

  const element = node as Element;
  stampElementSourceLine(element, originalLineFor);
  stampTaskCheckboxes(element, originalLineFor);
}

function stampElementSourceLine(element: Element, originalLineFor: number[]) {
  const startLine = element.position?.start?.line;

  if (typeof startLine !== "number" || startLine < 1) {
    return;
  }

  const original =
    originalLineFor[startLine - 1] !== undefined
      ? originalLineFor[startLine - 1]
      : startLine;

  if (!element.properties) {
    element.properties = {};
  }

  element.properties["data-source-line"] = String(original);
}

function originalSourceLineFor(element: Element, originalLineFor: number[]) {
  const startLine = element.position?.start?.line;
  if (typeof startLine !== "number" || startLine < 1) {
    return null;
  }
  return originalLineFor[startLine - 1] !== undefined
    ? originalLineFor[startLine - 1]
    : startLine;
}

function hasClass(element: Element, className: string) {
  const value = element.properties?.className;
  return Array.isArray(value)
    ? value.includes(className)
    : typeof value === "string" && value.split(/\s+/u).includes(className);
}

function isCheckboxInput(element: Element) {
  return element.tagName === "input" && element.properties?.type === "checkbox";
}

function leadingTaskCheckbox(element: Element): Element | null {
  const firstElementChild = element.children.find(
    (child): child is Element => child.type === "element",
  );

  if (!firstElementChild) {
    return null;
  }

  if (isCheckboxInput(firstElementChild)) {
    return firstElementChild;
  }

  if (firstElementChild.tagName !== "p") {
    return null;
  }

  const paragraphFirstElement = firstElementChild.children.find(
    (child): child is Element => child.type === "element",
  );
  return paragraphFirstElement && isCheckboxInput(paragraphFirstElement)
    ? paragraphFirstElement
    : null;
}

function textContent(node: ElementContent): string {
  if (node.type === "text") {
    return node.value;
  }

  if (node.type !== "element") {
    return "";
  }

  if (node.tagName === "input" || node.tagName === "ul" || node.tagName === "ol") {
    return "";
  }

  return node.children.map(textContent).join("");
}

function taskCheckboxLabel(element: Element, sourceLine: number) {
  const firstElementChild = element.children.find(
    (child): child is Element => child.type === "element",
  );
  const labelSource =
    firstElementChild?.tagName === "p" ? firstElementChild.children : element.children;
  const label = labelSource
    .map(textContent)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  return label ? `Toggle task: ${label}` : `Toggle task on line ${sourceLine}`;
}

// Build the accessible name for a synthesized table-cell checkbox. When the
// cell has trailing label text, use it so the control is distinguishable;
// otherwise fall back to a form carrying both the source line and the marker
// index so bare-marker cells in the same row stay individually targetable
// (finding arb-it1-5a).
function tableCheckboxLabel(
  cell: Element,
  checkbox: Element,
  sourceLine: number,
  markerIndex: string,
): string {
  const label = cell.children
    .filter((child) => child !== checkbox)
    .map(textContent)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  return label
    ? `Toggle task: ${label}`
    : `Toggle task on line ${sourceLine} (checkbox ${markerIndex})`;
}

// Stamp synthesized table-cell checkbox inputs within a table ROW. We anchor on
// the row's position (mapped FORMATTED -> ORIGINAL source line) and stamp each
// cell that the synthesis plugin converted. Walking from the row keeps the
// position lookup on the element that reliably carries it (verified: tr/td/th
// all carry position.start.line, plan §R3).
function stampTableRowCheckboxes(row: Element, originalLineFor: number[]) {
  const sourceLine = originalSourceLineFor(row, originalLineFor);
  if (sourceLine === null) {
    return;
  }

  for (const cell of row.children) {
    if (
      cell.type !== "element" ||
      (cell.tagName !== "td" && cell.tagName !== "th")
    ) {
      continue;
    }

    const checkbox = cell.children.find(
      (child): child is Element =>
        child.type === "element" &&
        isCheckboxInput(child) &&
        typeof child.properties?.["data-task-marker-index"] === "string",
    );
    if (!checkbox) {
      continue;
    }

    const markerIndex = checkbox.properties?.["data-task-marker-index"];
    checkbox.properties = checkbox.properties ?? {};
    checkbox.properties["data-task-source-line"] = String(sourceLine);
    checkbox.properties["aria-label"] = tableCheckboxLabel(
      cell,
      checkbox,
      sourceLine,
      typeof markerIndex === "string" ? markerIndex : "0",
    );
  }
}

function stampTaskCheckboxes(element: Element, originalLineFor: number[]) {
  if (element.tagName === "li" && hasClass(element, "task-list-item")) {
    const sourceLine = originalSourceLineFor(element, originalLineFor);
    const checkbox = leadingTaskCheckbox(element);
    if (sourceLine !== null && checkbox) {
      checkbox.properties = checkbox.properties ?? {};
      checkbox.properties["data-task-source-line"] = String(sourceLine);
      checkbox.properties["aria-label"] = taskCheckboxLabel(element, sourceLine);
    }
  }

  if (element.tagName === "tr") {
    stampTableRowCheckboxes(element, originalLineFor);
  }

  for (const child of element.children) {
    if (child.type === "element") {
      stampTaskCheckboxes(child, originalLineFor);
    }
  }
}
