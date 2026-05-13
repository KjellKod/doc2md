import { useLayoutEffect } from "react";
import {
  detectUnsupportedConstructs,
  formatLinkedInUnicodeWithLineMap,
} from "../linkedinFormatting";
import type { FindMatch } from "../useFindReplace";
import { useViewportAnchor } from "./useViewportAnchor";

type LinkedInPreviewTone =
  | "bold"
  | "italic"
  | "bold-italic"
  | "underline"
  | "strike";

interface LinkedInPreviewSegment {
  text: string;
  tone: LinkedInPreviewTone | null;
}

export interface LinkedInPreviewState {
  refusal: string | null;
  text: string | null;
  originalLineFor: number[];
}

interface MutableElementRef<T> {
  current: T | null;
}

interface LinkedInModeProps {
  state: LinkedInPreviewState;
  isFindOpen: boolean;
  activeFindMatch: FindMatch | null;
  renderedViewRef: MutableElementRef<HTMLElement>;
  pendingAnchorLineRef: MutableElementRef<number>;
  suppressMatchCenteringForModeSwitchRef: MutableElementRef<boolean>;
  renderedViewText: string;
  viewportTopFloor: () => number;
  onRenderedViewTextChange: (nextText: string) => void;
}

const UNDERLINE_MARK = "\u0332";
const STRIKE_MARK = "\u0336";

// eslint-disable-next-line react-refresh/only-export-components -- Shell needs copy text while this file owns LinkedIn preview derivation.
export function getLinkedInPreviewState(
  effectiveMarkdown: string,
): LinkedInPreviewState {
  const refusal = detectUnsupportedConstructs(effectiveMarkdown);

  if (refusal !== null) {
    return { refusal, text: null, originalLineFor: [] };
  }

  const withLineMap = formatLinkedInUnicodeWithLineMap(effectiveMarkdown);
  return {
    refusal: null,
    text: withLineMap.text,
    originalLineFor: withLineMap.originalLineFor,
  };
}

function toneForLinkedInCluster(cluster: string): LinkedInPreviewTone | null {
  if (cluster.includes(STRIKE_MARK)) {
    return "strike";
  }

  if (cluster.includes(UNDERLINE_MARK)) {
    return "underline";
  }

  const codePoint = cluster.codePointAt(0);

  if (!codePoint) {
    return null;
  }

  if (
    (codePoint >= 0x1d400 && codePoint <= 0x1d433) ||
    (codePoint >= 0x1d468 && codePoint <= 0x1d49b)
  ) {
    return codePoint >= 0x1d468 ? "bold-italic" : "bold";
  }

  if (
    codePoint === 0x210e ||
    (codePoint >= 0x1d434 && codePoint <= 0x1d467)
  ) {
    return "italic";
  }

  return null;
}

function renderLinkedInSegmentChildren(
  text: string,
  segmentOffset: number,
  match: { start: number; end: number } | null,
) {
  if (!match) {
    return text;
  }
  const segEnd = segmentOffset + text.length;
  if (match.end <= segmentOffset || match.start >= segEnd) {
    return text;
  }
  const overlapStart = Math.max(0, match.start - segmentOffset);
  const overlapEnd = Math.min(text.length, match.end - segmentOffset);
  if (overlapStart >= overlapEnd) {
    return text;
  }
  const before = text.slice(0, overlapStart);
  const matched = text.slice(overlapStart, overlapEnd);
  const after = text.slice(overlapEnd);
  return (
    <>
      {before}
      <mark className="markdown-rendered-find-highlight">{matched}</mark>
      {after}
    </>
  );
}

function segmentLinkedInPreview(text: string) {
  const clusters: string[] = [];

  for (const char of Array.from(text)) {
    if (
      (char === UNDERLINE_MARK || char === STRIKE_MARK) &&
      clusters.length > 0
    ) {
      clusters[clusters.length - 1] += char;
      continue;
    }

    clusters.push(char);
  }

  const segments: LinkedInPreviewSegment[] = [];

  for (const cluster of clusters) {
    const tone = toneForLinkedInCluster(cluster);
    const previous = segments[segments.length - 1];

    if (previous && previous.tone === tone) {
      previous.text += cluster;
      continue;
    }

    segments.push({ text: cluster, tone });
  }

  return segments;
}

function clampScrollTop(element: HTMLElement, scrollTop: number) {
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);

  return Math.min(Math.max(scrollTop, 0), maxScroll);
}

function centerElementInScrollContainer(
  container: HTMLElement,
  element: HTMLElement,
) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const targetScroll =
    container.scrollTop +
    elementRect.top -
    containerRect.top -
    (container.clientHeight - elementRect.height) / 2;

  container.scrollTop = clampScrollTop(container, targetScroll);
}

export default function LinkedInMode({
  state,
  isFindOpen,
  activeFindMatch,
  renderedViewRef,
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  renderedViewText,
  viewportTopFloor,
  onRenderedViewTextChange,
}: LinkedInModeProps) {
  const renderedFindHighlightMatch =
    isFindOpen && activeFindMatch
      ? { start: activeFindMatch.start, end: activeFindMatch.end }
      : null;
  const { applyAnchorLine } = useViewportAnchor(
    renderedViewRef,
    "rendered",
    { viewportTopFloor },
  );

  useLayoutEffect(() => {
    const anchorLine = pendingAnchorLineRef.current;
    if (anchorLine === null) {
      return;
    }
    if (!applyAnchorLine(anchorLine)) {
      return;
    }
    pendingAnchorLineRef.current = null;
    window.setTimeout(() => {
      suppressMatchCenteringForModeSwitchRef.current = false;
    }, 0);
  }, [
    applyAnchorLine,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
  ]);

  useLayoutEffect(() => {
    const element = renderedViewRef.current;

    if (!element) {
      onRenderedViewTextChange("");
      return;
    }

    const nextText = (element.textContent ?? "").replace(/\u200B/g, "");
    onRenderedViewTextChange(nextText);
  }, [onRenderedViewTextChange, renderedViewRef, state.text]);

  useLayoutEffect(() => {
    const element = renderedViewRef.current;
    if (!element) {
      return;
    }
    if (!isFindOpen || !activeFindMatch) {
      return;
    }
    if (pendingAnchorLineRef.current !== null) {
      return;
    }
    if (suppressMatchCenteringForModeSwitchRef.current) {
      return;
    }
    const highlight = element.querySelector(
      "mark.markdown-rendered-find-highlight",
    ) as HTMLElement | null;
    if (highlight) {
      centerElementInScrollContainer(element, highlight);
    }
  }, [
    activeFindMatch?.end,
    activeFindMatch?.start,
    activeFindMatch,
    isFindOpen,
    pendingAnchorLineRef,
    renderedViewRef,
    renderedViewText,
    suppressMatchCenteringForModeSwitchRef,
  ]);

  if (state.refusal) {
    return (
      <div className="linkedin-refusal" role="status">
        <p>{state.refusal}</p>
        <p>
          Remove tables or HTML from this draft to preview a LinkedIn-ready
          plain-text version.
        </p>
      </div>
    );
  }

  return (
    <pre
      ref={(element) => {
        renderedViewRef.current = element;
      }}
      className="linkedin-surface"
      aria-label="LinkedIn preview"
    >
      {(() => {
        const lines = (state.text ?? "").split("\n");
        let cursor = 0;
        const lineStarts = lines.map((line) => {
          const start = cursor;
          cursor += line.length + 1;
          return start;
        });
        return lines.map((line, lineIndex, all) => {
          const sourceLine =
            state.originalLineFor[lineIndex] ?? lineIndex + 1;
          const segments = segmentLinkedInPreview(line);
          let segOffset = lineStarts[lineIndex];
          return (
            <span key={`linkedin-line-${lineIndex}`}>
              <span
                className="linkedin-line"
                data-source-line={String(sourceLine)}
              >
                {segments.map(({ text, tone }, segmentIndex) => {
                  const children = renderLinkedInSegmentChildren(
                    text,
                    segOffset,
                    renderedFindHighlightMatch,
                  );
                  segOffset += text.length;
                  return tone ? (
                    <span
                      key={`${tone}-${segmentIndex}`}
                      className={`linkedin-emphasis linkedin-emphasis-${tone}`}
                    >
                      {children}
                    </span>
                  ) : (
                    <span key={`plain-${segmentIndex}`}>{children}</span>
                  );
                })}
              </span>
              {lineIndex < all.length - 1 ? "\n" : null}
            </span>
          );
        });
      })()}
    </pre>
  );
}
