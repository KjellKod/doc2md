import type { Element, ElementContent, Root, Text } from "hast";

/**
 * Rehype plugin that wraps the matched character range in a `<mark>`
 * element by traversing the hast tree in-place. This replaces the older
 * direct-DOM-mutation approach (`applyRenderedFindHighlight` in
 * `PreviewPanel.tsx`), which inserted `<mark>` into React-managed
 * children via `range.extractContents()` — that mutation produced
 * structural drift (duplicated `<strong>`/`<em>` nodes) on subsequent
 * React reconciliation, the bug documented at
 * `ideas/bug_report_find_highlight_dom_leaks.md`.
 *
 * Offset model (plan F2.0 Option A): the `match` parameters use
 * **rendered-text offsets** — character positions in the surface's
 * `.textContent`. This matches what `useFindReplace` already produces
 * when searching `renderedViewText` in `PreviewPanel.tsx`. We walk hast
 * text nodes in document order; each text node's `.value` contributes
 * its full character length to the rendered position cursor.
 *
 * Why hast and not mdast: hast nodes are HTML-shaped, so we can wrap a
 * matched span with a literal `<mark>` element directly. mdast lacks a
 * `<mark>` equivalent and would require a synthetic `hName` data hack.
 * Hast also runs after `remark-gfm` has resolved tables / lists /
 * task-checkboxes, so the offsets we see match what the user sees.
 *
 * Edge cases handled:
 *   - Match wholly inside a single text node → text node splits into
 *     `[before, <mark>matched</mark>, after]`.
 *   - Match spans multiple text nodes (e.g. crosses `<strong>`) → each
 *     intersected text node contributes its own `<mark>` slice;
 *     the visible result is multiple `<mark>` elements but the
 *     characters and structural elements are preserved.
 *   - Zero-width match (regex match at a position) → a `<mark>`
 *     containing a zero-width space (U+200B) is inserted at the
 *     position with class `markdown-rendered-find-highlight-zero`,
 *     matching the visible-caret behavior the old code emitted.
 *   - Match at start-of-document / end-of-document → degenerate cases
 *     work because the cursor walk uses inclusive bounds.
 */
const HIGHLIGHT_CLASS = "markdown-rendered-find-highlight";
const ZERO_CLASS = "markdown-rendered-find-highlight-zero";

export interface RenderedFindMatch {
  start: number;
  end: number;
}

export function findHighlightRehype(match: RenderedFindMatch | null) {
  return function plugin() {
    return function transformer(tree: Root) {
      if (!match) {
        return;
      }
      const cursor = { value: 0 };
      const inserted = { value: false };
      walk(tree, cursor, match, inserted);
    };
  };
}

interface Cursor {
  value: number;
}

interface Inserted {
  value: boolean;
}

function walk(
  node: Root | Element,
  cursor: Cursor,
  match: RenderedFindMatch,
  inserted: Inserted,
): void {
  const children = node.children as ElementContent[];
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];

    if (child.type === "text") {
      const text = child as Text;
      const replacement = splitTextNode(text, cursor, match, inserted);
      if (replacement) {
        children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      } else {
        cursor.value += text.value.length;
      }
      continue;
    }

    if (child.type === "element") {
      walk(child as Element, cursor, match, inserted);
      continue;
    }
    // raw / comment / doctype nodes: skip — they do not contribute
    // visible text in our pipeline (remark-gfm + react-markdown).
  }
}

function splitTextNode(
  text: Text,
  cursor: Cursor,
  match: RenderedFindMatch,
  inserted: Inserted,
): ElementContent[] | null {
  const nodeStart = cursor.value;
  const nodeEnd = nodeStart + text.value.length;

  // Zero-width insertion at the boundary (e.g. start of the very first
  // text node, end of the very last). Insert the caret marker exactly
  // once.
  if (
    match.start === match.end &&
    !inserted.value &&
    match.start >= nodeStart &&
    match.start <= nodeEnd
  ) {
    const localPos = match.start - nodeStart;
    const before = text.value.slice(0, localPos);
    const after = text.value.slice(localPos);
    inserted.value = true;
    cursor.value = nodeEnd;
    const ZERO_WIDTH_SPACE = "​";
    return [
      ...(before ? [{ type: "text" as const, value: before }] : []),
      makeMark(ZERO_WIDTH_SPACE, true),
      ...(after ? [{ type: "text" as const, value: after }] : []),
    ];
  }

  // Non-zero-width match. Does this node intersect [match.start, match.end)?
  if (match.start === match.end || nodeEnd <= match.start || nodeStart >= match.end) {
    return null;
  }

  const localStart = Math.max(match.start - nodeStart, 0);
  const localEnd = Math.min(match.end - nodeStart, text.value.length);

  const before = text.value.slice(0, localStart);
  const matched = text.value.slice(localStart, localEnd);
  const after = text.value.slice(localEnd);

  const replacement: ElementContent[] = [];
  if (before) {
    replacement.push({ type: "text", value: before });
  }
  if (matched.length > 0) {
    replacement.push(makeMark(matched, false));
  }
  if (after) {
    replacement.push({ type: "text", value: after });
  }
  cursor.value = nodeEnd;
  return replacement;
}

function makeMark(value: string, zeroWidth: boolean): Element {
  const className = zeroWidth ? `${HIGHLIGHT_CLASS} ${ZERO_CLASS}` : HIGHLIGHT_CLASS;
  return {
    type: "element",
    tagName: "mark",
    properties: { className },
    children: [{ type: "text", value }],
  };
}
