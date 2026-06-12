/**
 * Shared targeted-textarea edit primitives.
 *
 * Extracted from EditMode.tsx so the editor's keyboard commands and the
 * toolbar's Format JSON action commit through the SAME undo semantics: a
 * single native `insertText` so the browser records exactly one undo step.
 * Keeping one implementation prevents behavior drift between the two callers.
 */

export interface TargetedInsert {
  start: number;
  end: number;
  text: string;
  caretStart: number;
  caretEnd: number;
}

/**
 * Replace [start, end) in `textarea.value` with `text` via a native input
 * event so the browser records ONE undo step. Synchronously sets the
 * post-insertion selection. Returns true on success.
 */
export function commitTargetedInsert(
  textarea: HTMLTextAreaElement,
  insert: TargetedInsert,
): boolean {
  if (textarea.ownerDocument?.activeElement !== textarea) {
    textarea.focus();
  }
  if (textarea.ownerDocument?.activeElement !== textarea) {
    return false;
  }
  textarea.setSelectionRange(insert.start, insert.end);
  const exec = textarea.ownerDocument?.execCommand;
  if (typeof exec !== "function") {
    return false;
  }
  let ok: boolean;
  try {
    ok = exec.call(
      textarea.ownerDocument,
      "insertText",
      false,
      insert.text,
    );
  } catch {
    return false;
  }
  if (!ok) {
    return false;
  }
  textarea.setSelectionRange(insert.caretStart, insert.caretEnd);
  return true;
}

export function targetedFromSelectionEdit(
  oldValue: string,
  newValue: string,
  selectionStart: number,
  selectionEnd: number,
): TargetedInsert {
  let prefixLen = 0;
  const minLen = Math.min(oldValue.length, newValue.length);
  while (
    prefixLen < minLen &&
    oldValue.charCodeAt(prefixLen) === newValue.charCodeAt(prefixLen)
  ) {
    prefixLen += 1;
  }
  let suffixLen = 0;
  while (
    suffixLen < oldValue.length - prefixLen &&
    suffixLen < newValue.length - prefixLen &&
    oldValue.charCodeAt(oldValue.length - 1 - suffixLen) ===
      newValue.charCodeAt(newValue.length - 1 - suffixLen)
  ) {
    suffixLen += 1;
  }
  return {
    start: prefixLen,
    end: oldValue.length - suffixLen,
    text: newValue.slice(prefixLen, newValue.length - suffixLen),
    caretStart: selectionStart,
    caretEnd: selectionEnd,
  };
}
