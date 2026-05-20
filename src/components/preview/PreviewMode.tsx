import { useLayoutEffect, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FindMatch } from "../useFindReplace";
import { sourceLineRehype } from "../sourceLineRehype";
import { formatPreviewMarkdownWithLineMap } from "../previewFormatting";
import { useFindHighlight } from "./useFindHighlight";
import { useViewportAnchor } from "./useViewportAnchor";
import {
  snapshotRenderedViewText,
  useRenderedActiveMatchCentering,
  useRenderedAnchorApply,
} from "./renderedSurfaceEffects";

function shouldOpenMarkdownHrefExternally(href: unknown) {
  if (typeof href !== "string") {
    return false;
  }
  const normalizedHref = href.trim().toLowerCase();
  return (
    normalizedHref.startsWith("http://") ||
    normalizedHref.startsWith("https://") ||
    normalizedHref.startsWith("mailto:") ||
    normalizedHref.startsWith("tel:") ||
    normalizedHref.startsWith("//")
  );
}

// External anchors inside a converted document should not replace the SPA when
// clicked. Open them in a new tab/window so the user keeps their working state.
// Relative links and same-document hash links stay in-shell so TOCs and
// footnotes keep working like normal rendered Markdown.
const previewMarkdownComponents: Components = {
  // react-markdown passes an extra `node` (the mdast node) into the component.
  // Destructure it out so it can never be spread onto the underlying <a> as
  // an unknown DOM attribute. The local lint config does not honor
  // argsIgnorePattern, so use `void` to mark it as intentionally read.
  a({ node, children, ...props }) {
    void node;
    if (!shouldOpenMarkdownHrefExternally(props.href)) {
      return <a {...props}>{children}</a>;
    }
    return (
      <a {...props} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

interface MutableElementRef<T> {
  current: T | null;
}

interface PreviewModeProps {
  effectiveMarkdown: string;
  isFindOpen: boolean;
  activeFindMatch: FindMatch | null;
  previewRef: MutableElementRef<HTMLDivElement>;
  renderedViewRef: MutableElementRef<HTMLElement>;
  pendingAnchorLineRef: MutableElementRef<number>;
  suppressMatchCenteringForModeSwitchRef: MutableElementRef<boolean>;
  renderedViewText: string;
  viewportTopFloor: () => number;
  onRenderedViewTextChange: (nextText: string) => void;
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
  viewportTopFloor,
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
  }, [
    activeFindMatch,
    effectiveMarkdown,
    isFindOpen,
    onRenderedViewTextChange,
    previewMarkdown,
    renderedViewRef,
  ]);

  useRenderedActiveMatchCentering({
    renderedViewRef,
    isFindOpen,
    activeFindMatch,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    renderedViewText,
  });

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
        components={previewMarkdownComponents}
      >
        {previewMarkdown}
      </ReactMarkdown>
    </div>
  );
}
