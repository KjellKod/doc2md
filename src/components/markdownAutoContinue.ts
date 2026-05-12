export type MarkerKind =
  | "bullet"
  | "ordered"
  | "blockquote"
  | "task-unchecked"
  | "task-checked";

export interface ParsedMarker {
  kind: MarkerKind;
  indent: string;
  bulletChar?: "-" | "*" | "+";
  orderedNumber?: number;
  /** Length of the prefix including indent + marker + single trailing space. */
  prefixLength: number;
  /** True when the line content equals just the marker (empty list item). */
  isEmpty: boolean;
}

export interface AutoContinueEdit {
  value: string;
  caretPos: number;
}

const BULLET_RE = /^(\s*)([-*+])\s$/;
const BULLET_WITH_CONTENT_RE = /^(\s*)([-*+])\s+(.+?)\s*$/;
const TASK_RE = /^(\s*)([-*+])\s\[( |x|X)\]\s$/;
const TASK_WITH_CONTENT_RE = /^(\s*)([-*+])\s\[( |x|X)\]\s+(.+?)\s*$/;
const ORDERED_RE = /^(\s*)(\d{1,9})\.\s$/;
const ORDERED_WITH_CONTENT_RE = /^(\s*)(\d{1,9})\.\s+(.+?)\s*$/;
const BLOCKQUOTE_RE = /^(\s*)>\s$/;
const BLOCKQUOTE_WITH_CONTENT_RE = /^(\s*)>\s+(.+?)\s*$/;

/**
 * Detect the leading indent unit used by the document. Returns the first
 * indented line's leading whitespace, or two spaces by default for new docs.
 */
export function detectIndentUnit(text: string): string {
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.length === 0) continue;
    if (line[0] === "\t") {
      return "\t";
    }
    const spaceMatch = line.match(/^( +)\S/);
    if (spaceMatch) {
      return spaceMatch[1];
    }
  }
  return "  ";
}

/**
 * Parse the marker on the line that contains `caretPos`. Returns null when
 * the caret is not on a list/blockquote line.
 */
export function parseLineMarker(value: string, caretPos: number): ParsedMarker | null {
  const lineStart = value.lastIndexOf("\n", caretPos - 1) + 1;
  const lineEnd = value.indexOf("\n", caretPos);
  const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);

  const taskEmpty = TASK_RE.exec(line);
  if (taskEmpty) {
    const checkedFlag = taskEmpty[3].toLowerCase() === "x";
    return {
      kind: checkedFlag ? "task-checked" : "task-unchecked",
      indent: taskEmpty[1],
      bulletChar: taskEmpty[2] as "-" | "*" | "+",
      prefixLength: line.length,
      isEmpty: true,
    };
  }
  const taskWith = TASK_WITH_CONTENT_RE.exec(line);
  if (taskWith) {
    const checkedFlag = taskWith[3].toLowerCase() === "x";
    const prefix = `${taskWith[1]}${taskWith[2]} [${taskWith[3]}] `;
    return {
      kind: checkedFlag ? "task-checked" : "task-unchecked",
      indent: taskWith[1],
      bulletChar: taskWith[2] as "-" | "*" | "+",
      prefixLength: prefix.length,
      isEmpty: false,
    };
  }

  const bulletEmpty = BULLET_RE.exec(line);
  if (bulletEmpty) {
    return {
      kind: "bullet",
      indent: bulletEmpty[1],
      bulletChar: bulletEmpty[2] as "-" | "*" | "+",
      prefixLength: line.length,
      isEmpty: true,
    };
  }
  const bulletWith = BULLET_WITH_CONTENT_RE.exec(line);
  if (bulletWith) {
    const prefix = `${bulletWith[1]}${bulletWith[2]} `;
    return {
      kind: "bullet",
      indent: bulletWith[1],
      bulletChar: bulletWith[2] as "-" | "*" | "+",
      prefixLength: prefix.length,
      isEmpty: false,
    };
  }

  const orderedEmpty = ORDERED_RE.exec(line);
  if (orderedEmpty) {
    return {
      kind: "ordered",
      indent: orderedEmpty[1],
      orderedNumber: Number.parseInt(orderedEmpty[2], 10),
      prefixLength: line.length,
      isEmpty: true,
    };
  }
  const orderedWith = ORDERED_WITH_CONTENT_RE.exec(line);
  if (orderedWith) {
    const prefix = `${orderedWith[1]}${orderedWith[2]}. `;
    return {
      kind: "ordered",
      indent: orderedWith[1],
      orderedNumber: Number.parseInt(orderedWith[2], 10),
      prefixLength: prefix.length,
      isEmpty: false,
    };
  }

  const blockquoteEmpty = BLOCKQUOTE_RE.exec(line);
  if (blockquoteEmpty) {
    return {
      kind: "blockquote",
      indent: blockquoteEmpty[1],
      prefixLength: line.length,
      isEmpty: true,
    };
  }
  const blockquoteWith = BLOCKQUOTE_WITH_CONTENT_RE.exec(line);
  if (blockquoteWith) {
    const prefix = `${blockquoteWith[1]}> `;
    return {
      kind: "blockquote",
      indent: blockquoteWith[1],
      prefixLength: prefix.length,
      isEmpty: false,
    };
  }

  return null;
}

function buildContinuationPrefix(marker: ParsedMarker): string {
  switch (marker.kind) {
    case "bullet":
      return `${marker.indent}${marker.bulletChar} `;
    case "task-unchecked":
    case "task-checked":
      return `${marker.indent}${marker.bulletChar} [ ] `;
    case "ordered":
      return `${marker.indent}${(marker.orderedNumber ?? 0) + 1}. `;
    case "blockquote":
      return `${marker.indent}> `;
  }
}

/**
 * Compute the auto-continue edit for an Enter keypress at `caretPos`. Returns
 * null if the line is not a list/blockquote line. The caller is expected to
 * guard against IME composition before invoking this function.
 *
 * When the caret is on an empty marker line, the marker is cleared and the
 * caret stays at the start of the (now blank) line — exiting the list.
 */
export function computeAutoContinueEdit(
  value: string,
  caretPos: number,
  selectionEnd?: number,
): AutoContinueEdit | null {
  // Only operate on a collapsed caret OR a same-line selection. Multi-line
  // selections fall through to the default newline behavior.
  const selEnd = selectionEnd ?? caretPos;
  if (selEnd !== caretPos) {
    const between = value.slice(Math.min(caretPos, selEnd), Math.max(caretPos, selEnd));
    if (between.includes("\n")) {
      return null;
    }
  }

  const marker = parseLineMarker(value, caretPos);
  if (!marker) {
    return null;
  }

  const lineStart = value.lastIndexOf("\n", caretPos - 1) + 1;

  if (marker.isEmpty) {
    // Strip the marker entirely; leave a blank line.
    const before = value.slice(0, lineStart);
    const after = value.slice(lineStart + marker.prefixLength);
    return {
      value: `${before}${after}`,
      caretPos: lineStart,
    };
  }

  const prefix = buildContinuationPrefix(marker);
  const insertion = `\n${prefix}`;
  const start = Math.min(caretPos, selEnd);
  const end = Math.max(caretPos, selEnd);
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    caretPos: start + insertion.length,
  };
}
