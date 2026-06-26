// GFM task-list syntax (`- [ ]` / `- [x]`) only renders as a checkbox at the
// START of a list item. Inside a Markdown table cell it has no special
// meaning, so it survives as literal text (`- [ ]`) and never becomes a
// checkbox in the rendered table. Authors who paste a table with a "marked"
// column expect a checkbox, not raw brackets.
//
// The fix: inside table cells only, rewrite a checkbox marker to a checkbox
// GLYPH that renders verbatim in any context — ☐ (unchecked) / ☑ (checked).
// Genuine task lists (outside tables) and fenced code blocks are left
// untouched so their `- [ ]` markers keep working.

const UNCHECKED_GLYPH = "☐"; // U+2610 BALLOT BOX
const CHECKED_GLYPH = "☑"; // U+2611 BALLOT BOX WITH CHECK

// A table row in the leading/trailing-pipe style this app emits, e.g.
// `| a | b |`. Requires a pipe at both ends so prose containing a stray `|`
// is not mistaken for a table row.
const TABLE_ROW = /^\s*\|.*\|\s*$/;

// A GFM delimiter row: each cell is dashes with optional alignment colons,
// e.g. `| --- | :--: |`. This is the line that proves the pipe rows above
// and below it are an actual table rather than incidental pipes.
const DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

const FENCE = /^\s*(`{3,}|~{3,})/;

// Within a single cell, match a checkbox marker: an optional task-list bullet
// (`-`/`*`/`+`) followed by `[ ]`, `[x]`, or `[X]`. The marker must sit at a
// word boundary and not be the label of a Markdown link/reference (`[x](…)`
// or `[x][…]`), which would be a false positive.
const CELL_CHECKBOX = /(^|\s)(?:[-*+]\s+)?\[([ xX])\](?![([])/g;

function convertCheckboxesInCell(cell: string): string {
  return cell.replace(CELL_CHECKBOX, (_match, lead: string, state: string) => {
    const glyph = state === " " ? UNCHECKED_GLYPH : CHECKED_GLYPH;
    return `${lead}${glyph}`;
  });
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
 * are touched; the delimiter row, genuine task lists, and fenced code blocks
 * are left unchanged.
 */
export function convertTableCellCheckboxes(markdown: string): string {
  // Fast path: nothing that could be a checkbox marker.
  if (!markdown.includes("[")) return markdown;

  const lines = markdown.split("\n");
  const shouldConvert = new Array<boolean>(lines.length).fill(false);

  let fenceChar: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const fenceMatch = lines[i].match(FENCE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (fenceChar === null) fenceChar = char;
      else if (char === fenceChar) fenceChar = null;
      continue;
    }
    if (fenceChar !== null) continue;

    // A delimiter row with a pipe table row directly above it marks a real
    // table: convert that header and every body row that follows until the
    // table block ends.
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
