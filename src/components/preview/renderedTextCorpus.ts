// Bridges the gap between what the user sees in the rendered preview
// surface and what the find input searches against. Plain
// `element.textContent` concatenates cell text with no separator so
// "AtlasJordanOn Track" comes out of `<tr><td>Atlas</td><td>Jordan</td>
// <td>On Track</td></tr>` and adjacent-cell phrases never match
// (ideas/bug_report_find_preview_table_cells.md).
//
// The fix is a virtual-separator rule applied at element boundaries:
// a space at the close of cell-like elements (td, th, dt, dd, li) and
// a newline at the close of block-like elements (tr, p, div, br,
// h1..h6). Both the live-DOM walk (here) and the hast walk in
// findHighlightRehype.ts MUST use the same rule so that match offsets
// in rendered-text-offset space stay coherent across the two
// pipelines.

const SPACE_TAGS = new Set(["td", "th", "dt", "dd", "li"]);
const NEWLINE_TAGS = new Set([
  "tr",
  "p",
  "div",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

export function elementBoundarySeparator(tagName: string): string {
  const tag = tagName.toLowerCase();
  if (SPACE_TAGS.has(tag)) {
    return " ";
  }
  if (NEWLINE_TAGS.has(tag)) {
    return "\n";
  }
  return "";
}

// Walk a live DOM element in document order, emitting each text node's
// content plus the virtual separator (if any) after each element child
// closes. Used by snapshotRenderedViewText to build the corpus that
// `useFindReplace` searches against.
//
// Notes:
//   - U+200B (zero-width space) is stripped from text nodes. It's a
//     sentinel inserted by findHighlightRehype for zero-width caret
//     marks; it should not affect subsequent search corpora.
//   - DOM node types other than text / element are skipped (comments,
//     CDATA, processing instructions) — they don't appear in the
//     react-markdown output but we stay defensive.
//   - The separator is emitted AFTER recursing into the element, so
//     the cursor position in offset-space matches what
//     findHighlightRehype's walk produces.
export function deriveRenderedText(element: HTMLElement): string {
  let out = "";
  const children = element.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent ?? "").replace(/\u200B/g, "");
      continue;
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      const elementChild = child as HTMLElement;
      out += deriveRenderedText(elementChild);
      out += elementBoundarySeparator(elementChild.tagName);
    }
  }
  return out;
}
