/**
 * Pure-DOM helpers that read and write the "top line" of either a
 * textarea (via a synced `<pre>` mirror) or a rendered surface (via
 * `[data-source-line]` stamps). All four helpers operate on injected
 * DOM nodes and assume the caller has flushed any pending layout
 * before invoking them. They're the unit-test target for the
 * line-anchor mode-switch behavior; PreviewPanel only wires them.
 */

const EPSILON = 4;

function clampScrollTop(element: HTMLElement, scrollTop: number) {
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
  return Math.min(Math.max(scrollTop, 0), maxScroll);
}

function offsetForLine(source: string, line: number): number {
  const sourceLines = source.split("\n");
  const targetLine = Math.max(1, Math.min(line, sourceLines.length));
  let offset = 0;

  for (let index = 0; index < targetLine - 1; index += 1) {
    offset += sourceLines[index].length + 1; // +1 for the newline char
  }

  return offset;
}

function lineForOffset(source: string, offset: number): number {
  if (offset <= 0) {
    return 1;
  }

  return source.slice(0, offset).split("\n").length;
}

interface MeasuredCharacter {
  offset: number;
  top: number;
}

function rangeRect(range: Range): DOMRect | null {
  if (typeof range.getBoundingClientRect !== "function") {
    return null;
  }
  return range.getBoundingClientRect();
}

function measureFirstVisibleCharacter(
  mirror: HTMLElement,
  containerTop: number,
): MeasuredCharacter | null {
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
  let textOffset = 0;
  let current: Node | null = walker.nextNode();
  let lastSeenTop = -Infinity;
  let lastOffset = 0;

  while (current) {
    const textNode = current as Text;
    const length = textNode.data.length;

    for (let index = 0; index < length; index += 1) {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, Math.min(index + 1, length));
      const rect = rangeRect(range);
      range.detach?.();

      if (!rect) {
        continue;
      }

      // Skip zero-rect characters (e.g. between text nodes after newlines).
      if (rect.top === 0 && rect.bottom === 0 && rect.left === 0) {
        continue;
      }

      lastSeenTop = rect.top;
      lastOffset = textOffset + index;

      if (rect.top >= containerTop - EPSILON) {
        return { offset: textOffset + index, top: rect.top };
      }
    }

    textOffset += length;
    current = walker.nextNode();
  }

  if (lastSeenTop !== -Infinity) {
    return { offset: lastOffset, top: lastSeenTop };
  }

  return null;
}

/**
 * Read the source line for the character that's at the top of the
 * textarea's viewport, using a synced `<pre>` mirror that shares the
 * textarea's font, padding, and width so that text-node y-coords match
 * the textarea's internal layout.
 *
 * The mirror's `scrollTop` is forced to match the textarea before any
 * measurement, so the caller cannot accidentally bypass the contract.
 */
export function topLineFromTextareaMirror(
  textarea: HTMLTextAreaElement,
  mirror: HTMLElement | null,
  source: string,
): number {
  if (!mirror) {
    return 1;
  }

  mirror.scrollTop = textarea.scrollTop;
  const containerTop = mirror.getBoundingClientRect().top;
  const measured = measureFirstVisibleCharacter(mirror, containerTop);

  if (!measured) {
    return 1;
  }

  return lineForOffset(source, measured.offset);
}

/**
 * Read the source line for the topmost stamped element in a rendered
 * container. Prefers the first non-blank stamped block whose top is at
 * or below the container's top edge; falls back to the last stamped
 * line for end-of-doc, or `1` when nothing is stamped.
 */
export function topLineFromRendered(container: HTMLElement): number {
  const stamped = Array.from(
    container.querySelectorAll<HTMLElement>("[data-source-line]"),
  );

  if (stamped.length === 0) {
    return 1;
  }

  const containerTop = container.getBoundingClientRect().top;
  let firstQualifying: HTMLElement | null = null;
  let firstNonBlankQualifying: HTMLElement | null = null;

  for (const element of stamped) {
    const rect = element.getBoundingClientRect();
    if (rect.top < containerTop - EPSILON) {
      continue;
    }

    if (firstQualifying === null) {
      firstQualifying = element;
    }

    const isBlank = (element.textContent ?? "").trim().length === 0;
    if (!isBlank && firstNonBlankQualifying === null) {
      firstNonBlankQualifying = element;
      break;
    }
  }

  const chosen = firstNonBlankQualifying ?? firstQualifying;

  if (chosen) {
    return parseSourceLine(chosen);
  }

  // End-of-doc fallback: use the last stamped element.
  return parseSourceLine(stamped[stamped.length - 1]);
}

function parseSourceLine(element: HTMLElement): number {
  const value = element.dataset.sourceLine;
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Adjust `container.scrollTop` so the smallest stamped source line
 * `>= line` aligns with the container's top (within 1 px). Falls back
 * to the last stamped element for end-of-doc.
 */
export function scrollRenderedToLine(container: HTMLElement, line: number) {
  const stamped = Array.from(
    container.querySelectorAll<HTMLElement>("[data-source-line]"),
  );

  if (stamped.length === 0) {
    container.scrollTop = 0;
    return;
  }

  let chosen: HTMLElement | null = null;
  let chosenLine = Infinity;

  for (const element of stamped) {
    const candidate = parseSourceLine(element);
    if (candidate >= line && candidate < chosenLine) {
      chosen = element;
      chosenLine = candidate;
    }
  }

  if (!chosen) {
    chosen = stamped[stamped.length - 1];
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = chosen.getBoundingClientRect();
  const target =
    container.scrollTop + (elementRect.top - containerRect.top);

  container.scrollTop = clampScrollTop(container, target);
}

/**
 * Set `textarea.scrollTop` so the character at the start of the
 * requested line lands at the top of the viewport (clamped to the
 * scroll range). Uses the synced mirror when provided; otherwise
 * builds a transient `<pre>` shadow that mirrors the textarea's
 * computed font/padding/width and removes it after measurement.
 */
export function scrollTextareaToLine(
  textarea: HTMLTextAreaElement,
  mirror: HTMLElement | null,
  source: string,
  line: number,
) {
  const offset = offsetForLine(source, line);
  const measureMirror = mirror ?? buildShadowMirror(textarea);
  const cleanup = mirror ? null : measureMirror;

  try {
    measureMirror.scrollTop = 0;
    const top = measureCharacterTop(measureMirror, offset);

    if (top === null) {
      return;
    }

    const mirrorTop = measureMirror.getBoundingClientRect().top;
    const target = top - mirrorTop;

    textarea.scrollTop = clampScrollTop(textarea, target);
  } finally {
    if (cleanup && cleanup.parentNode) {
      cleanup.parentNode.removeChild(cleanup);
    }
  }
}

function measureCharacterTop(
  mirror: HTMLElement,
  offset: number,
): number | null {
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let current: Node | null = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    const length = textNode.data.length;
    if (offset >= cursor && offset <= cursor + length) {
      const localOffset = Math.min(Math.max(offset - cursor, 0), length);
      const safeStart = Math.min(localOffset, Math.max(length - 1, 0));
      const range = document.createRange();
      range.setStart(textNode, safeStart);
      range.setEnd(textNode, Math.min(safeStart + 1, length));
      const rect = rangeRect(range);
      range.detach?.();
      return rect ? rect.top : null;
    }
    cursor += length;
    current = walker.nextNode();
  }

  return null;
}

function buildShadowMirror(textarea: HTMLTextAreaElement): HTMLPreElement {
  const shadow = document.createElement("pre");
  const computed = window.getComputedStyle(textarea);

  shadow.textContent = textarea.value;
  shadow.style.position = "absolute";
  shadow.style.visibility = "hidden";
  shadow.style.left = "-99999px";
  shadow.style.top = "0";
  shadow.style.whiteSpace = "pre-wrap";
  shadow.style.wordBreak = "break-word";
  shadow.style.overflowWrap = "break-word";
  shadow.style.boxSizing = "border-box";
  shadow.style.font = computed.font;
  shadow.style.fontFamily = computed.fontFamily;
  shadow.style.fontSize = computed.fontSize;
  shadow.style.fontWeight = computed.fontWeight;
  shadow.style.lineHeight = computed.lineHeight;
  shadow.style.letterSpacing = computed.letterSpacing;
  shadow.style.padding = computed.padding;
  shadow.style.borderWidth = computed.borderWidth;
  shadow.style.borderStyle = "solid";
  shadow.style.borderColor = "transparent";
  shadow.style.width = `${textarea.clientWidth}px`;

  document.body.appendChild(shadow);
  return shadow;
}
