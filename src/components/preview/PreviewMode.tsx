import { useLayoutEffect, useMemo, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FindMatch } from "../useFindReplace";
import { sourceLineRehype } from "../sourceLineRehype";
import { formatPreviewMarkdownWithLineMap } from "../previewFormatting";
import { useFindHighlight } from "./useFindHighlight";

interface MutableElementRef<T> {
  current: T | null;
}

interface PreviewModeProps {
  effectiveMarkdown: string;
  isFindOpen: boolean;
  activeFindMatch: FindMatch | null;
  previewRef: MutableElementRef<HTMLDivElement>;
  renderedViewRef: MutableElementRef<HTMLElement>;
  pendingAnchorLineRef: RefObject<number | null>;
  suppressMatchCenteringForModeSwitchRef: RefObject<boolean>;
  renderedViewText: string;
  onRenderedViewTextChange: (nextText: string) => void;
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

export default function PreviewMode({
  effectiveMarkdown,
  isFindOpen,
  activeFindMatch,
  previewRef,
  renderedViewRef,
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  renderedViewText,
  onRenderedViewTextChange,
}: PreviewModeProps) {
  const previewWithLineMap = useMemo(
    () => formatPreviewMarkdownWithLineMap(effectiveMarkdown),
    [effectiveMarkdown],
  );
  const previewMarkdown = previewWithLineMap.markdown;
  const renderedFindHighlightMatch = useMemo(
    () =>
      isFindOpen && activeFindMatch
        ? { start: activeFindMatch.start, end: activeFindMatch.end }
        : null,
    [activeFindMatch, isFindOpen],
  );
  const findHighlight = useFindHighlight(renderedFindHighlightMatch);
  const previewRehypePlugins = useMemo(
    () => [
      sourceLineRehype(previewWithLineMap.originalLineFor),
      findHighlight,
    ],
    [findHighlight, previewWithLineMap.originalLineFor],
  );

  function shouldCenterActiveMatch() {
    return !suppressMatchCenteringForModeSwitchRef.current;
  }

  useLayoutEffect(() => {
    const element = renderedViewRef.current;

    if (!element) {
      onRenderedViewTextChange("");
      return;
    }

    const nextText = (element.textContent ?? "").replace(/\u200B/g, "");
    onRenderedViewTextChange(nextText);
  }, [
    activeFindMatch,
    effectiveMarkdown,
    isFindOpen,
    onRenderedViewTextChange,
    previewMarkdown,
    renderedViewRef,
  ]);

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
    if (!shouldCenterActiveMatch()) {
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

  return (
    <div
      className="markdown-surface"
      ref={(element) => {
        previewRef.current = element;
        renderedViewRef.current = element;
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={previewRehypePlugins}
      >
        {previewMarkdown}
      </ReactMarkdown>
    </div>
  );
}
