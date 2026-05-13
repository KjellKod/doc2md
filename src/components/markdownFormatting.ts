export interface SelectionEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type ListKind = "ordered" | "unordered" | "task";

const LIST_LINE_RE = /^(\s*)(?:[-*+]\s\[( |x|X)\]\s|[-*+]\s|\d+\.\s)/;

/**
 * Wrap or unwrap the [start, end) selection with the given prefix and suffix.
 * When the selection is already wrapped with matching markers, the markers
 * are removed (toggle). Zero-width selections insert `prefix + suffix` and
 * place the caret between them (or, if `caretInside` is provided, at that
 * offset within the wrapper).
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string = prefix,
): SelectionEdit {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  if (start === end) {
    return {
      value: `${before}${prefix}${suffix}${after}`,
      selectionStart: before.length + prefix.length,
      selectionEnd: before.length + prefix.length,
    };
  }

  // Toggle off when the selection starts with prefix AND ends with suffix.
  if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length);
    return {
      value: `${before}${inner}${after}`,
      selectionStart: before.length,
      selectionEnd: before.length + inner.length,
    };
  }

  // Toggle off when prefix/suffix sit immediately outside the selection.
  if (
    before.endsWith(prefix) &&
    after.startsWith(suffix)
  ) {
    const newBefore = before.slice(0, before.length - prefix.length);
    const newAfter = after.slice(suffix.length);
    return {
      value: `${newBefore}${selected}${newAfter}`,
      selectionStart: newBefore.length,
      selectionEnd: newBefore.length + selected.length,
    };
  }

  return {
    value: `${before}${prefix}${selected}${suffix}${after}`,
    selectionStart: before.length + prefix.length,
    selectionEnd: before.length + prefix.length + selected.length,
  };
}

/**
 * Insert a Markdown link wrapping the current selection.
 * - URL-looking selection -> `[link text](URL)` with "link text" selected.
 * - Non-empty text -> `[selection](url)` with `url` selected.
 * - Zero-width -> `[](url)` with caret between the brackets.
 */
export function insertLink(
  value: string,
  start: number,
  end: number,
): SelectionEdit {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  if (start === end) {
    const linkText = "[](url)";
    return {
      value: `${before}${linkText}${after}`,
      selectionStart: before.length + 1,
      selectionEnd: before.length + 1,
    };
  }

  const urlPattern = /^https?:\/\/\S+$/;
  if (urlPattern.test(selected)) {
    const text = "link text";
    const next = `[${text}](${selected})`;
    return {
      value: `${before}${next}${after}`,
      selectionStart: before.length + 1,
      selectionEnd: before.length + 1 + text.length,
    };
  }

  const placeholder = "url";
  const next = `[${selected}](${placeholder})`;
  return {
    value: `${before}${next}${after}`,
    selectionStart: before.length + selected.length + 3,
    selectionEnd: before.length + selected.length + 3 + placeholder.length,
  };
}

const PAIRS: Record<string, string> = {
  "*": "*",
  _: "_",
  "`": "`",
  "[": "]",
  "(": ")",
  '"': '"',
};

/**
 * Smart-wrap the selection with the matching pair character. Returns null
 * if `openChar` is not a smart-wrap character or there is no selection
 * (caret-only insertions should fall through to default typing behavior).
 */
export function smartWrapInsert(
  value: string,
  start: number,
  end: number,
  openChar: string,
): SelectionEdit | null {
  if (start === end) {
    return null;
  }
  const close = PAIRS[openChar];
  if (close === undefined) {
    return null;
  }
  return wrapSelection(value, start, end, openChar, close);
}

interface LineSpan {
  start: number;
  end: number;
  text: string;
}

function linesIn(value: string, start: number, end: number): LineSpan[] {
  const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lastLineEndIndex = value.indexOf("\n", end);
  const lastLineEnd = lastLineEndIndex === -1 ? value.length : lastLineEndIndex;
  const slice = value.slice(firstLineStart, lastLineEnd);
  const out: LineSpan[] = [];
  let cursor = firstLineStart;
  for (const text of slice.split("\n")) {
    out.push({ start: cursor, end: cursor + text.length, text });
    cursor += text.length + 1;
  }
  return out;
}

function lineIsListKind(line: string, kind: ListKind): boolean {
  const match = LIST_LINE_RE.exec(line);
  if (!match) return false;
  const trimmed = line.slice(match[1].length);
  if (kind === "task") {
    return /^[-*+]\s\[( |x|X)\]\s/.test(trimmed);
  }
  if (kind === "unordered") {
    return /^[-*+]\s/.test(trimmed) && !/^[-*+]\s\[/.test(trimmed);
  }
  return /^\d+\.\s/.test(trimmed);
}

function stripListMarker(line: string): { indent: string; rest: string } {
  const match = LIST_LINE_RE.exec(line);
  if (match) {
    return { indent: match[1], rest: line.slice(match[0].length) };
  }
  // Non-list lines still split off their leading whitespace so the marker is
  // applied AFTER the indent.
  const indentMatch = /^(\s*)/.exec(line);
  const indent = indentMatch ? indentMatch[1] : "";
  return { indent, rest: line.slice(indent.length) };
}

function buildListMarker(kind: ListKind, index: number): string {
  switch (kind) {
    case "unordered":
      return "- ";
    case "task":
      return "- [ ] ";
    case "ordered":
      return `${index + 1}. `;
  }
}

/**
 * Toggle a list marker on each line covered by [start, end]. If every covered
 * line already has the requested marker kind, the markers are removed.
 * Otherwise, the marker kind is applied uniformly.
 */
export function toggleListLine(
  value: string,
  start: number,
  end: number,
  kind: ListKind,
): SelectionEdit {
  const spans = linesIn(value, start, end);
  const allAlready = spans.every((span) => lineIsListKind(span.text, kind));

  let resultText = "";
  const prefix = value.slice(0, spans[0].start);
  const suffix = value.slice(spans[spans.length - 1].end);
  const newSelectionStart = prefix.length;

  spans.forEach((span, index) => {
    let nextLine: string;
    if (allAlready) {
      const { indent, rest } = stripListMarker(span.text);
      nextLine = `${indent}${rest}`;
    } else {
      const { indent, rest } = stripListMarker(span.text);
      const marker = buildListMarker(kind, index);
      nextLine = `${indent}${marker}${rest}`;
    }
    resultText += nextLine;
    if (index < spans.length - 1) resultText += "\n";
  });

  const newSelectionEnd = prefix.length + resultText.length;
  return {
    value: `${prefix}${resultText}${suffix}`,
    selectionStart: newSelectionStart,
    selectionEnd: newSelectionEnd,
  };
}

export interface AtomicEditResult {
  ok: boolean;
}

/**
 * Attempt to commit `next` to the textarea as an atomic native edit that
 * the browser records as a single undo step. We do this by:
 *
 *   1. Calling `textarea.focus()` so `execCommand` sees a valid editable.
 *   2. Asserting `document.activeElement === textarea` — if focus could not
 *      be obtained (e.g. detached node), return ok:false.
 *   3. Selecting the entire current contents.
 *   4. Calling `document.execCommand('insertText', false, next)`.
 *
 * On Chromium this commits one native input event; the controlled React
 * onChange fires with the same value, so the next render does not clobber
 * the native undo entry.
 *
 * Returns ok:false on any failure (helper does not throw). Callers should
 * fall back to a controlled-write path.
 */
export function applyAtomicTextareaEdit(
  textarea: HTMLTextAreaElement,
  next: string,
): AtomicEditResult {
  try {
    textarea.focus();
    if (textarea.ownerDocument?.activeElement !== textarea) {
      return { ok: false };
    }
    textarea.setSelectionRange(0, textarea.value.length);
    const exec = textarea.ownerDocument?.execCommand?.bind(textarea.ownerDocument);
    if (!exec) {
      return { ok: false };
    }
    const ok = exec("insertText", false, next);
    // Defense in depth: some environments (jsdom, mocked test doubles) return
    // true without actually mutating the textarea. Treat a value mismatch as
    // a failed atomic edit so the caller falls back to the controlled write.
    if (ok && textarea.value !== next) {
      return { ok: false };
    }
    return { ok };
  } catch {
    return { ok: false };
  }
}
