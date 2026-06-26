// GFM task-list syntax (`- [ ]` / `- [x]`) only renders as a checkbox at the
// START of a list item. Inside a Markdown table cell it has no special
// meaning, so it survives as literal text (`- [ ]`) and never becomes a
// checkbox in the rendered table. Authors who paste a table with a "marked"
// column expect a checkbox, not raw brackets.
//
// The fix: inside table cells only, rewrite a checkbox marker to a checkbox
// GLYPH that renders verbatim in any context — ☐ (unchecked) / ☑ (checked).
// Genuine task lists (outside tables), fenced/indented code, inline code,
// link labels, and incidental `[x]` in prose are all left untouched.
//
// Scope note: only tables in the leading/trailing-pipe style (`| a | b |`)
// are recognized — the style this app emits and that users paste. Pipe-less
// GFM tables (`a | b`) are intentionally skipped: a missed conversion is
// harmless, whereas treating ordinary prose with a stray `|` as a table
// would corrupt it.

const UNCHECKED_GLYPH = "☐"; // U+2610 BALLOT BOX
const CHECKED_GLYPH = "☑"; // U+2611 BALLOT BOX WITH CHECK

// Indented code begins at 4 leading spaces, so block constructs are only
// recognized with 0–3 spaces of indentation (no leading tab).
const INDENT = " {0,3}";

// A table row in the leading/trailing-pipe style, e.g. `| a | b |`. Requires
// a pipe at both ends so prose containing a stray `|` is not mistaken for one.
const TABLE_ROW = new RegExp(`^${INDENT}\\|.*\\|\\s*$`);

// A GFM delimiter row: each cell is dashes with optional alignment colons,
// e.g. `| --- | :--: |`. The leading `(?=.*\\|)` requires at least one pipe so
// a bare `---` thematic break is never mistaken for a delimiter — TABLE_ROW
// only supports pipe-wrapped rows, so the delimiter must carry a pipe too.
const DELIMITER_ROW = new RegExp(
  `^${INDENT}(?=.*\\|)\\|?\\s*:?-+:?\\s*(?:\\|\\s*:?-+:?\\s*)*\\|?\\s*$`,
);

// A fence line: 0–3 spaces, then 3+ backticks or tildes, then an info string.
const FENCE = new RegExp(`^${INDENT}(\`{3,}|~{3,})(.*)$`);

// A checkbox marker carried by a task-list bullet (`-`/`*`/`+`). The leading
// bullet is what makes this unambiguous task syntax (vs. incidental `[x]` in
// prose). Not matched when it is actually a link/reference label (`[x](…)` /
// `[x][…]`).
const BULLETED_CHECKBOX = /(^|\s)[-*+]\s+\[([ xX])\](?![([])/g;

// A cell whose entire (trimmed) content is a checkbox marker, with or without
// a bullet. The anchors guarantee it is the whole cell, so `[x](url)` (a link)
// and `[x] then text` (prose) never match.
const WHOLE_CELL_CHECKBOX = /^(?:[-*+]\s+)?\[([ xX])\]$/;

function glyphFor(state: string): string {
  return state === " " ? UNCHECKED_GLYPH : CHECKED_GLYPH;
}

// Apply `fn` to the parts of `text` that are NOT inside an inline code span
// (a run of backticks closed by an equal-length run), so literal markdown
// examples like `` `- [ ]` `` in a cell are preserved.
function replaceOutsideInlineCode(
  text: string,
  fn: (segment: string) => string,
): string {
  if (!text.includes("`")) return fn(text);
  return text
    .split(/(`+[^`]*`+)/)
    .map((part) => (part.startsWith("`") ? part : fn(part)))
    .join("");
}

function convertCheckboxesInCell(cell: string): string {
  const trimmed = cell.trim();

  // The common case: a cell that is nothing but a marker. Replace just the
  // trimmed token so the cell's surrounding padding is preserved.
  const whole = trimmed.match(WHOLE_CELL_CHECKBOX);
  if (whole) return cell.replace(trimmed, glyphFor(whole[1]));

  // Otherwise only a bulleted task marker counts, and never inside inline code.
  return replaceOutsideInlineCode(cell, (segment) =>
    segment.replace(
      BULLETED_CHECKBOX,
      (_match, lead: string, state: string) => `${lead}${glyphFor(state)}`,
    ),
  );
}

function convertCheckboxesInRow(row: string): string {
  // Split on every pipe and convert each cell independently, then rejoin so
  // the original column structure (including leading/trailing pipes) is
  // preserved exactly.
  return row.split("|").map(convertCheckboxesInCell).join("|");
}

/**
 * Replace task-list checkbox markers that appear inside Markdown table cells
 * with checkbox glyphs (☐ / ☑). Only header and body rows of a real GFM table
 * are touched; the delimiter row, genuine task lists, fenced/indented code,
 * inline code, and link labels are left unchanged.
 */
export function convertTableCellCheckboxes(markdown: string): string {
  // Fast path: nothing that could be a checkbox marker.
  if (!markdown.includes("[")) return markdown;

  const lines = markdown.split("\n");
  const shouldConvert = new Array<boolean>(lines.length).fill(false);

  // Track the open fence by marker char and length: a fence only closes on a
  // line with the same char, a length >= the opener, and nothing but trailing
  // whitespace after it.
  let fence: { char: string; length: number } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const fenceMatch = lines[i].match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const char = marker[0];
      if (fence === null) {
        fence = { char, length: marker.length };
      } else if (
        char === fence.char &&
        marker.length >= fence.length &&
        fenceMatch[2].trim().length === 0
      ) {
        fence = null;
      }
      // Either way this line is fence punctuation, never a table row.
      continue;
    }
    if (fence !== null) continue;

    // A delimiter row with a pipe table row directly above it marks a real
    // table: convert that header and every body row until the table ends.
    if (
      DELIMITER_ROW.test(lines[i]) &&
      i > 0 &&
      TABLE_ROW.test(lines[i - 1]) &&
      !DELIMITER_ROW.test(lines[i - 1])
    ) {
      shouldConvert[i - 1] = true;
      for (
        let j = i + 1;
        j < lines.length &&
        TABLE_ROW.test(lines[j]) &&
        !DELIMITER_ROW.test(lines[j]);
        j += 1
      ) {
        shouldConvert[j] = true;
      }
    }
  }

  if (!shouldConvert.includes(true)) return markdown;

  return lines
    .map((line, i) => (shouldConvert[i] ? convertCheckboxesInRow(line) : line))
    .join("\n");
}
