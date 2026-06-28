// Canonical marker module for interactive task checkboxes inside GFM table
// cells. This is the SINGLE source of truth for what a table-cell checkbox
// marker is and where it lives in the raw source. Both the render side
// (synthesis plugin, index assignment) and the write-back side call these
// pure functions on the SAME raw source string, so the render-side marker
// index can never drift from the write-back marker span (plan §4.0).
//
// Everything here operates on RAW source text — never decoded HAST — so that
// escaped brackets (`\[ \]`) are seen with their backslashes and stay literal
// (plan §4.0, BLOCKER 2). Recognition rules are exact (plan §4.3):
//   1. Bare bracket, WHOLE trimmed cell is `[ ]`, `[x]`, or `[X]`.
//   2. Bulleted at cell start: `-`/`*`/`+` + space + `[ ]`/`[x]`/`[X]`, with an
//      optional trailing label that is preserved.
// Ordered markers (`1)`/`1.`) are deliberately NOT a table-cell form; they
// belong to the unchanged list-item path in taskCheckboxSource.ts.

export type CellMarkerState = "checked" | "unchecked";

export interface CellMarker {
  /** Ordinal of the source cell within the row (0-based). */
  cellIndex: number;
  /** Ordinal among REAL markers in the row (0-based). */
  markerIndex: number;
  state: CellMarkerState;
  /** Absolute offset of the marker's `[` within the raw source line. */
  lineOffsetStart: number;
  /** Absolute offset one past the marker's `]` within the raw source line. */
  lineOffsetEnd: number;
}

export interface RowMarkers {
  markers: CellMarker[];
  /** Number of raw source cells (for the alignment fail-safe, plan §4.1). */
  rawCellCount: number;
}

type RecognizedMarker = Pick<
  CellMarker,
  "state" | "lineOffsetStart" | "lineOffsetEnd"
>;

// The bracket body: exactly one space (unchecked) or x/X (checked).
const BARE_CELL_PATTERN = /^\[(?: |x|X)\]$/u;
// Leading bullet form: bullet + space + bracket. Trailing label allowed.
const BULLETED_PREFIX_PATTERN = /^[-*+][ \t]+\[(?: |x|X)\]/u;

function markerState(bracketBody: string): CellMarkerState {
  return bracketBody === " " ? "unchecked" : "checked";
}

/**
 * Recognize the single LEADING checkbox marker in ONE raw source cell, or
 * null. Offsets are relative to the start of `rawCell`. Operates on raw text
 * so backslash escapes are visible (and rejected).
 */
export function recognizeCellMarker(rawCell: string): RecognizedMarker | null {
  // Leading/trailing whitespace inside the cell is insignificant in GFM.
  const leadingWhitespace = rawCell.length - rawCell.trimStart().length;
  const trimmed = rawCell.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // Rule 1: bare bracket, whole trimmed cell only.
  if (BARE_CELL_PATTERN.test(trimmed)) {
    const start = leadingWhitespace;
    return {
      state: markerState(trimmed[1]),
      lineOffsetStart: start,
      lineOffsetEnd: start + trimmed.length,
    };
  }

  // Rule 2: bulleted at cell start, optional trailing label.
  const bulletMatch = BULLETED_PREFIX_PATTERN.exec(trimmed);
  if (bulletMatch) {
    const matched = bulletMatch[0];
    // The `[` sits at the last 3 chars of the matched prefix (`[ ]`).
    const bracketOffsetInTrimmed = matched.length - 3;
    const bracketBody = matched[matched.length - 2];
    const start = leadingWhitespace + bracketOffsetInTrimmed;
    return {
      state: markerState(bracketBody),
      lineOffsetStart: start,
      lineOffsetEnd: start + 3,
    };
  }

  return null;
}

/**
 * Split a raw table-row source line into cells on UNESCAPED pipes, honoring
 * the leading/trailing pipe style. Returns the cell text segments plus the
 * absolute offset where each segment begins in `rawSourceLine`.
 *
 * GFM table rows may omit the outer pipes, but this app does not support
 * pipe-less tables (plan non-goals), so we treat a leading/trailing pipe as
 * the table-row convention and drop the empty edge segments it produces.
 */
function splitRowCells(
  rawSourceLine: string,
): { text: string; offset: number }[] {
  const segments: { text: string; offset: number }[] = [];
  let current = "";
  let currentStart = 0;
  let escaped = false;

  for (let i = 0; i < rawSourceLine.length; i += 1) {
    const ch = rawSourceLine[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === "|") {
      segments.push({ text: current, offset: currentStart });
      current = "";
      currentStart = i + 1;
      continue;
    }
    current += ch;
  }
  segments.push({ text: current, offset: currentStart });

  // Drop the empty edge segments produced by leading/trailing pipes. A pipe at
  // the very start yields an empty first segment; one at the very end yields an
  // empty last segment. Interior empty cells (`|  |`) are kept.
  if (segments.length > 1 && segments[0].text.trim() === "") {
    segments.shift();
  }
  if (
    segments.length > 1 &&
    segments[segments.length - 1].text.trim() === ""
  ) {
    segments.pop();
  }

  return segments;
}

/**
 * Enumerate the real checkbox markers in a raw table-row source line. Splits on
 * unescaped pipes, runs recognizeCellMarker per cell, and returns ordered real
 * markers with absolute line offsets and stable indices, plus rawCellCount for
 * the alignment fail-safe.
 *
 * CAVEAT: a naive unescaped-pipe split over-counts when a pipe sits inside an
 * inline code span or link (`` `a|b` ``). The synthesis plugin's raw-count vs
 * DOM-cell-count fail-safe (plan §4.1) catches that and skips the row rather
 * than mis-mapping cells.
 */
export function enumerateRowMarkers(rawSourceLine: string): RowMarkers {
  const cells = splitRowCells(rawSourceLine);
  const markers: CellMarker[] = [];
  let markerIndex = 0;

  cells.forEach((cell, cellIndex) => {
    const recognized = recognizeCellMarker(cell.text);
    if (!recognized) {
      return;
    }
    markers.push({
      cellIndex,
      markerIndex,
      state: recognized.state,
      lineOffsetStart: cell.offset + recognized.lineOffsetStart,
      lineOffsetEnd: cell.offset + recognized.lineOffsetEnd,
    });
    markerIndex += 1;
  });

  return { markers, rawCellCount: cells.length };
}

/**
 * Toggle the real marker at `markerIndex` by absolute offset. Returns the line
 * unchanged when the index is out of range (fail-safe: a missed toggle is
 * acceptable; a wrong-span mutation is not — review finding arb-it1-3).
 */
export function toggleRowMarkerByIndex(
  rawSourceLine: string,
  markerIndex: number,
  checked: boolean,
): string {
  if (!Number.isInteger(markerIndex) || markerIndex < 0) {
    return rawSourceLine;
  }

  const { markers } = enumerateRowMarkers(rawSourceLine);
  const marker = markers[markerIndex];
  if (!marker) {
    return rawSourceLine;
  }

  // The marker span is exactly `[ ]` / `[x]` / `[X]`; flip the middle char.
  const before = rawSourceLine.slice(0, marker.lineOffsetStart);
  const after = rawSourceLine.slice(marker.lineOffsetEnd);
  const replacement = `[${checked ? "x" : " "}]`;
  return `${before}${replacement}${after}`;
}
