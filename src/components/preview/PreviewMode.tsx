import {
  type ChangeEvent,
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
import { classifyMarkdownHref } from "../../render/markdownLinks";
import { useFindHighlight } from "./useFindHighlight";
import { useViewportAnchor } from "./useViewportAnchor";
import {
  snapshotRenderedViewText,
  useRenderedActiveMatchCentering,
  useRenderedAnchorApply,
} from "./renderedSurfaceEffects";
import { replaceTaskMarkerAtSourceLine } from "./taskCheckboxSource";

// Link classification (external / anchor / disabled) is shared with the
// static HTML export renderer via src/render/markdownLinks.ts so the two
// outputs cannot drift. Preview mode adds editor-only treatment on top of
// the classification: disabled links get a tooltip-wrapper span plus click,
// aux-click, and key guards. Export emits an inert anchor with no wrapper.
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
    // Wrap the anchor so the project's CSS-only tooltip pattern can hang off
    // it without resorting to the native `title` attribute (slow, OS-styled).
    return (
      <span className="markdown-disabled-link-group">
        <a
          {...props}
          {...hrefAttribute}
          className={disabledClassName}
          aria-disabled="true"
          // Out of tab order: keyboard users cannot focus a link they cannot
          // follow. Mouse and right-click (Copy Link) still work.
          tabIndex={-1}
          onClick={preventDisabledLinkNavigation}
          // Middle-click and other auxiliary buttons would otherwise open the
          // preserved href in a new tab/window in browser-like hosts.
          onAuxClick={preventDisabledLinkNavigation}
          onKeyDown={preventDisabledLinkKeyActivation}
        >
          {children}
        </a>
        <span role="tooltip" className="markdown-disabled-link-tooltip">
          Repository link, open in your editor
        </span>
      </span>
    );
  },
};

function previewMarkdownComponentsFor(
  onTaskCheckboxToggle?: (sourceLine: number, checked: boolean) => void,
): Components {
  if (!onTaskCheckboxToggle) {
    return previewMarkdownComponents;
  }

  return {
    ...previewMarkdownComponents,
    input({ node, type, checked, disabled, ...props }) {
      void node;
      const taskSourceLineValue = (props as Record<string, unknown>)[
        "data-task-source-line"
      ];
      const taskSourceLine =
        typeof taskSourceLineValue === "string"
          ? Number.parseInt(taskSourceLineValue, 10)
          : Number.NaN;

      if (type !== "checkbox" || !Number.isInteger(taskSourceLine)) {
        return (
          <input
            {...props}
            type={type}
            checked={checked}
            disabled={disabled}
          />
        );
      }

      return (
        <input
          {...props}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={false}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onTaskCheckboxToggle(taskSourceLine, event.currentTarget.checked)
          }
        />
      );
    },
  };
}

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
  onReportView?: () => void;
  onMarkdownChange?: (markdown: string) => void;
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
  onReportView,
  onMarkdownChange,
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
  const previewComponents = useMemo(
    () =>
      previewMarkdownComponentsFor(
        onMarkdownChange
          ? (sourceLine, checked) => {
              const nextMarkdown = replaceTaskMarkerAtSourceLine(
                effectiveMarkdown,
                sourceLine,
                checked,
              );
              if (nextMarkdown !== effectiveMarkdown) {
                onMarkdownChange(nextMarkdown);
              }
            }
          : undefined,
      ),
    [effectiveMarkdown, onMarkdownChange],
  );
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
      onScroll={() => onReportView?.()}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={previewRehypePlugins}
        components={previewComponents}
      >
        {previewMarkdown}
      </ReactMarkdown>
    </div>
  );
}
