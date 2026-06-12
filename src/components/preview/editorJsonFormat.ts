/**
 * Pure detection + formatting for the editor's one-shot Format JSON action.
 *
 * No React, no DOM: given the textarea value and the current selection range,
 * decide whether there is a confidently-JSON target and, if so, return the
 * exact targeted edit to commit. Returns null whenever the target is not
 * confidently JSON, so the toolbar button can stay disabled and no rewrite is
 * ever committed on a guess.
 *
 * Canonical format source: src/converters/json.ts (`convertJsonText`). The
 * shared semantics is `JSON.stringify(parsed, null, 2)` plus, for a whole
 * document of raw JSON, the ```json fence wrapper. Keep the two in sync.
 */

import type { TargetedInsert } from "./targetedTextareaEdit";

// Anchor strictly on ```json followed only by horizontal whitespace then EOL.
// This rejects info strings like ```json5 / ```jsonc so a non-JSON fence is
// never reformatted and silently retagged to ```json (brief §2, Risk #5).
const JSON_FENCE_RE = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n?```$/;

/** First non-whitespace char of a trimmed string is `{` or `[`. */
function looksLikeRawJson(trimmed: string): boolean {
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/** Pretty-print raw JSON to 2-space indent, or null if it does not parse. */
function formatJsonBody(raw: string): string | null {
  const trimmed = raw.trim();
  if (!looksLikeRawJson(trimmed)) {
    return null;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

/**
 * If `text` (already trimmed) is a single ```json … ``` fenced block, return
 * its body; otherwise null. Uses the strict anchor above so json5/jsonc fences
 * do not match.
 */
function matchJsonFence(text: string): { body: string } | null {
  const match = JSON_FENCE_RE.exec(text);
  if (!match) {
    return null;
  }
  return { body: match[1] };
}

/**
 * Detect a format-safe JSON target and return the targeted edit to apply, or
 * null when there is nothing confidently formattable.
 *
 * Selection first (selStart !== selEnd): operate on the selected span only.
 *  - a ```json fenced block → reformat body, preserve the fence
 *  - raw JSON (starts with {/[ and parses) → indent in place, NON-fenced
 *    (fencing a mid-document selection would inject ``` lines into the
 *    surrounding Markdown — exactly the unexpected rewrite brief §2 forbids)
 *
 * No selection: operate on the whole value, preserving any leading/trailing
 * blank lines around the trimmed span.
 *  - a ```json fenced block → reformat body, preserve the fence
 *  - raw JSON → wrap as a ```json fenced block (matches upload output)
 */
export function detectJsonFormatTarget(
  value: string,
  selStart: number,
  selEnd: number,
): TargetedInsert | null {
  if (selStart !== selEnd) {
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    const selected = value.slice(start, end);
    const trimmed = selected.trim();

    const fence = matchJsonFence(trimmed);
    if (fence) {
      const body = formatJsonBody(fence.body);
      if (body === null) {
        return null;
      }
      const formatted = rebuildSpan(selected, "```json\n" + body + "\n```");
      return {
        start,
        end,
        text: formatted,
        caretStart: start,
        caretEnd: start + formatted.length,
      };
    }

    const body = formatJsonBody(selected);
    if (body === null) {
      return null;
    }
    const formatted = rebuildSpan(selected, body);
    return {
      start,
      end,
      text: formatted,
      caretStart: start,
      caretEnd: start + formatted.length,
    };
  }

  // No selection: whole document, preserving leading/trailing blank lines.
  const firstNonWs = value.search(/\S/);
  if (firstNonWs === -1) {
    return null;
  }
  const lastNonWs = lastNonWhitespaceIndex(value);
  const start = firstNonWs;
  const end = lastNonWs + 1;
  const core = value.slice(start, end);

  const fence = matchJsonFence(core);
  if (fence) {
    const body = formatJsonBody(fence.body);
    if (body === null) {
      return null;
    }
    const text = "```json\n" + body + "\n```";
    return {
      start,
      end,
      text,
      caretStart: start,
      caretEnd: start + text.length,
    };
  }

  const body = formatJsonBody(core);
  if (body === null) {
    return null;
  }
  const text = "```json\n" + body + "\n```";
  return {
    start,
    end,
    text,
    caretStart: start,
    caretEnd: start + text.length,
  };
}

/** Index of the last non-whitespace character in `value` (>= 0 here). */
function lastNonWhitespaceIndex(value: string): number {
  for (let i = value.length - 1; i >= 0; i -= 1) {
    if (!/\s/.test(value[i])) {
      return i;
    }
  }
  return -1;
}

/**
 * Re-wrap `formattedCore` with the same leading/trailing whitespace the
 * original selected span carried, so a selection like "\n{…}\n" keeps its
 * surrounding blank lines and only the JSON body is reflowed.
 */
function rebuildSpan(original: string, formattedCore: string): string {
  const leadMatch = /^\s*/.exec(original);
  const trailMatch = /\s*$/.exec(original);
  const lead = leadMatch ? leadMatch[0] : "";
  const trail = trailMatch ? trailMatch[0] : "";
  return lead + formattedCore + trail;
}
