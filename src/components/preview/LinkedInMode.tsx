import { useLayoutEffect } from "react";
import {
  detectUnsupportedConstructs,
  formatLinkedInUnicodeWithLineMap,
} from "../linkedinFormatting";
import type { FindMatch } from "../useFindReplace";
import { useViewportAnchor } from "./useViewportAnchor";
import {
  snapshotRenderedViewText,
  useRenderedActiveMatchCentering,
  useRenderedAnchorApply,
} from "./renderedSurfaceEffects";

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
  onReportView?: () => void;
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

export default function LinkedInMode({
  state,
  isFindOpen,
  activeFindMatch,
  renderedViewRef,
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  renderedViewText,
  viewportTopFloor,
  onReportView,
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

  useRenderedAnchorApply({
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    applyAnchorLine,
  });

  useLayoutEffect(() => {
    snapshotRenderedViewText(renderedViewRef.current, onRenderedViewTextChange);
  }, [onRenderedViewTextChange, renderedViewRef, state.text]);

  useRenderedActiveMatchCentering({
    renderedViewRef,
    isFindOpen,
    activeFindMatch,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    renderedViewText,
  });

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
      onScroll={() => onReportView?.()}
    >
      {(() => {
        const lines = (state.text ?? "").split("\n");
        const lineStarts: number[] = [];
        {
          let acc = 0;
          for (const line of lines) {
            lineStarts.push(acc);
            acc += line.length + 1;
          }
        }
        return lines.map((line, lineIndex, all) => {
          const sourceLine =
            state.originalLineFor[lineIndex] ?? lineIndex + 1;
          const segments = segmentLinkedInPreview(line);
          const segmentOffsets: number[] = [];
          {
            let acc = lineStarts[lineIndex];
            for (const segment of segments) {
              segmentOffsets.push(acc);
              acc += segment.text.length;
            }
          }
          return (
            <span key={`linkedin-line-${lineIndex}`}>
              <span
                className="linkedin-line"
                data-source-line={String(sourceLine)}
              >
                {segments.map(({ text, tone }, segmentIndex) => {
                  const children = renderLinkedInSegmentChildren(
                    text,
                    segmentOffsets[segmentIndex],
                    renderedFindHighlightMatch,
                  );
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
