import {
  useLayoutEffect,
  useMemo,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
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

// A link in a rendered Markdown document falls into one of three buckets:
//
//   external — http(s), mailto, tel, or protocol-relative (//...). Opens in
//              the user's default browser via target=_blank. The Mac shell
//              additionally hands off to NSWorkspace.
//   anchor   — pure hash fragment (#section). Stays in-shell so it can scroll
//              to a heading. rehype-slug gives every heading a matching id.
//   disabled — everything else: repo-relative paths (../README.md), absolute
//              paths (/foo), relative paths with a hash (../guide.md#section),
//              empty href, and any unknown scheme including data:, blob:,
//              file:, vscode:, and javascript:. doc2md has no file-system
//              path resolver, so following these would just navigate the
//              webview to a 404. Render as a visibly-disabled link with the
//              original href preserved (so right-click / copy-link still works
//              against the source repo on a host that can resolve it, like
//              github.com).
type MarkdownLinkClassification =
  | { kind: "external"; href: string }
  | { kind: "anchor"; href: string }
  | { kind: "disabled"; href: string | null };

function classifyMarkdownHref(href: unknown): MarkdownLinkClassification {
  if (typeof href !== "string") {
    return { kind: "disabled", href: null };
  }
  const trimmed = href.trim();
  if (trimmed === "") {
    return { kind: "disabled", href: null };
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("//")) {
    return { kind: "external", href: `https:${trimmed}` };
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return { kind: "external", href: trimmed };
  }
  if (trimmed.startsWith("#")) {
    return { kind: "anchor", href: trimmed };
  }
  return { kind: "disabled", href: trimmed };
}

function preventDisabledLinkNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

function preventDisabledLinkKeyActivation(
  event: KeyboardEvent<HTMLAnchorElement>,
) {
  // <a> elements activate on Enter; treat Space the same so screen-reader
  // shortcuts that focus a disabled link cannot accidentally navigate.
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
  }
}

const previewMarkdownComponents: Components = {
  // react-markdown passes an extra `node` (the mdast node) into the component.
  // Destructure it out so it can never be spread onto the underlying <a> as
  // an unknown DOM attribute. The local lint config does not honor
  // argsIgnorePattern, so use `void` to mark it as intentionally read.
  a({ node, children, className, href, ...props }) {
    void node;
    const classification = classifyMarkdownHref(href);
    if (classification.kind === "external") {
      return (
        <a
          {...props}
          className={className}
          href={classification.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }
    if (classification.kind === "anchor") {
      return (
        <a {...props} className={className} href={classification.href}>
          {children}
        </a>
      );
    }
    const disabledClassName = className
      ? `markdown-disabled-link ${className}`
      : "markdown-disabled-link";
    const hrefAttribute =
      classification.href === null ? {} : { href: classification.href };
    return (
      <a
        {...props}
        {...hrefAttribute}
        className={disabledClassName}
        aria-disabled="true"
        // Out of tab order: keyboard users cannot focus a link they cannot
        // follow. Mouse and right-click (Copy Link) still work.
        tabIndex={-1}
        title="Repository link — open in your editor"
        onClick={preventDisabledLinkNavigation}
        // Middle-click and other auxiliary buttons would otherwise open the
        // preserved href in a new tab/window in browser-like hosts.
        onAuxClick={preventDisabledLinkNavigation}
        onKeyDown={preventDisabledLinkKeyActivation}
      >
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
      // rehype-slug runs first so heading ids are in place before the
      // source-line tagger or find-highlighter touch the tree.
      rehypeSlug,
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
