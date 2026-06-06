import {
  type ChangeEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
import {
  parseDominantMarkdownTable,
  type LargeMarkdownAnalysis,
} from "../../render/largeMarkdown";
import { useFindHighlight } from "./useFindHighlight";
import { useViewportAnchor } from "./useViewportAnchor";
import {
  snapshotRenderedViewText,
  useRenderedActiveMatchCentering,
  useRenderedAnchorApply,
} from "./renderedSurfaceEffects";
import { replaceTaskMarkerAtSourceLine } from "./taskCheckboxSource";
import { LargeJsonPreviewView } from "./LargeJsonPreviewView";
import { getLargeJsonPreview } from "./largeJsonPreview";

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
  largeMarkdownAnalysis?: LargeMarkdownAnalysis | null;
  viewportTopFloor: () => number;
  onReportView?: () => void;
  onMarkdownChange?: (markdown: string) => void;
  onRenderedViewTextChange: (nextText: string) => void;
}

export default function PreviewMode({
  largeMarkdownAnalysis,
  ...props
}: PreviewModeProps) {
  if (largeMarkdownAnalysis?.useFallbackPreview) {
    return (
      <LargeMarkdownPreviewMode
        {...props}
        largeMarkdownAnalysis={largeMarkdownAnalysis}
      />
    );
  }

  return <RichPreviewMode {...props} largeMarkdownAnalysis={null} />;
}

function RichPreviewMode({
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
  const largeJsonPreview = useMemo(
    () => getLargeJsonPreview(effectiveMarkdown),
    [effectiveMarkdown],
  );
  const previewWithLineMap = useMemo(
    () =>
      largeJsonPreview === null
        ? formatPreviewMarkdownWithLineMap(effectiveMarkdown)
        : null,
    [effectiveMarkdown, largeJsonPreview],
  );
  const previewMarkdown = previewWithLineMap?.markdown ?? "";
  const renderedFindHighlightMatch = useMemo(
    () =>
      largeJsonPreview === null && isFindOpen && activeFindMatch
        ? { start: activeFindMatch.start, end: activeFindMatch.end }
        : null,
    [activeFindMatch, isFindOpen, largeJsonPreview],
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
    () =>
      previewWithLineMap === null
        ? []
        : [
          // rehype-slug runs first so heading ids are in place before the
          // source-line tagger or find-highlighter touch the tree.
          rehypeSlug,
          sourceLineRehype(previewWithLineMap.originalLineFor),
          findHighlight,
        ],
    [findHighlight, previewWithLineMap],
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
    if (largeJsonPreview !== null) {
      onRenderedViewTextChange(largeJsonPreview.previewText);
      return;
    }
    snapshotRenderedViewText(renderedViewRef.current, onRenderedViewTextChange);
  }, [
    activeFindMatch,
    effectiveMarkdown,
    isFindOpen,
    largeJsonPreview,
    onRenderedViewTextChange,
    previewMarkdown,
    renderedViewRef,
  ]);

  useRenderedActiveMatchCentering({
    renderedViewRef,
    isFindOpen: largeJsonPreview === null && isFindOpen,
    activeFindMatch: largeJsonPreview === null ? activeFindMatch : null,
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
      {largeJsonPreview !== null ? (
        <LargeJsonPreviewView state={largeJsonPreview} />
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={previewRehypePlugins}
          components={previewComponents}
        >
          {previewMarkdown}
        </ReactMarkdown>
      )}
    </div>
  );
}

type LargeMarkdownPreviewModeProps = Omit<
  PreviewModeProps,
  "largeMarkdownAnalysis"
> & {
  largeMarkdownAnalysis: LargeMarkdownAnalysis;
};

function LargeMarkdownPreviewMode({
  effectiveMarkdown,
  isFindOpen,
  activeFindMatch,
  previewRef,
  renderedViewRef,
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  renderedViewText,
  largeMarkdownAnalysis,
  viewportTopFloor,
  onReportView,
  onMarkdownChange,
  onRenderedViewTextChange,
}: LargeMarkdownPreviewModeProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const [tableBodyTop, setTableBodyTop] = useState(0);
  const table = useMemo(
    () => parseDominantMarkdownTable(effectiveMarkdown),
    [effectiveMarkdown],
  );

  function updateScrollMetrics(element: HTMLDivElement) {
    setScrollTop(element.scrollTop);
    setViewportHeight(element.clientHeight || 640);
    const tableBody = tableBodyRef.current;
    if (tableBody) {
      const surfaceRect = element.getBoundingClientRect();
      const bodyRect = tableBody.getBoundingClientRect();
      setTableBodyTop(bodyRect.top - surfaceRect.top + element.scrollTop);
    }
  }

  useLayoutEffect(() => {
    const element = surfaceRef.current;
    if (element) {
      updateScrollMetrics(element);
    }
  }, [effectiveMarkdown, table]);

  const lineLabel =
    largeMarkdownAnalysis.lineCount === 1
      ? "1 line"
      : `${largeMarkdownAnalysis.lineCount} lines`;
  const tableLineLabel =
    largeMarkdownAnalysis.tableLineCount === 1
      ? "1 table line"
      : `${largeMarkdownAnalysis.tableLineCount} table lines`;
  const rowHeight = 42;
  const overscan = 16;
  const rowScrollTop = Math.max(scrollTop - tableBodyTop, 0);
  const visibleStart = Math.max(
    0,
    Math.floor(rowScrollTop / rowHeight) - overscan,
  );
  const visibleCapacity = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const visibleRows =
    table?.rows.slice(visibleStart, visibleStart + visibleCapacity) ?? [];
  const beforeHeight = visibleStart * rowHeight;
  const afterHeight =
    Math.max((table?.rows.length ?? 0) - visibleStart - visibleRows.length, 0) *
    rowHeight;
  const columnCount = table
    ? Math.max(
        table.header.length,
        ...visibleRows.map((row) => row.cells.length),
      )
    : 0;
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
    effectiveMarkdown,
    isFindOpen,
    onRenderedViewTextChange,
    renderedViewRef,
    visibleStart,
  ]);

  useRenderedActiveMatchCentering({
    renderedViewRef,
    isFindOpen,
    activeFindMatch,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    renderedViewText,
  });

  if (!table) {
    return (
      <RichPreviewMode
        effectiveMarkdown={effectiveMarkdown}
        isFindOpen={isFindOpen}
        activeFindMatch={activeFindMatch}
        previewRef={previewRef}
        renderedViewRef={renderedViewRef}
        pendingAnchorLineRef={pendingAnchorLineRef}
        suppressMatchCenteringForModeSwitchRef={
          suppressMatchCenteringForModeSwitchRef
        }
        renderedViewText={renderedViewText}
        largeMarkdownAnalysis={null}
        viewportTopFloor={viewportTopFloor}
        onReportView={onReportView}
        onMarkdownChange={onMarkdownChange}
        onRenderedViewTextChange={onRenderedViewTextChange}
      />
    );
  }

  return (
    <div
      className="markdown-surface markdown-surface-large-document"
      ref={(element) => {
        surfaceRef.current = element;
        previewRef.current = element;
        renderedViewRef.current = element;
      }}
      onScroll={(event) => {
        updateScrollMetrics(event.currentTarget);
        onReportView?.();
      }}
    >
      <div className="large-markdown-notice" role="status">
        <strong>Large report</strong>
        <span>
          Rendering the document with a virtualized table for {lineLabel},{" "}
          {tableLineLabel}.
        </span>
      </div>
      <MarkdownDocumentFragment markdown={table.beforeMarkdown} />
      <table className="large-markdown-table">
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              <th
                key={`${index}-${cell}`}
                style={{ textAlign: table.alignments[index] ?? undefined }}
              >
                <MarkdownTableCell markdown={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={tableBodyRef}>
          {beforeHeight > 0 ? (
            <tr aria-hidden="true">
              <td
                className="large-markdown-table-spacer"
                colSpan={columnCount}
                style={{ height: `${beforeHeight}px` }}
              />
            </tr>
          ) : null}
          {visibleRows.map((row) => (
            <tr
              key={row.sourceLine}
              data-source-line={row.sourceLine}
              style={{ height: `${rowHeight}px` }}
            >
              {Array.from({ length: columnCount }, (_, index) => (
                <td
                  key={index}
                  style={{ textAlign: table.alignments[index] ?? undefined }}
                >
                  <MarkdownTableCell markdown={row.cells[index] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
          {afterHeight > 0 ? (
            <tr aria-hidden="true">
              <td
                className="large-markdown-table-spacer"
                colSpan={columnCount}
                style={{ height: `${afterHeight}px` }}
              />
            </tr>
          ) : null}
        </tbody>
      </table>
      <MarkdownDocumentFragment markdown={table.afterMarkdown} />
    </div>
  );
}

function MarkdownDocumentFragment({ markdown }: { markdown: string }) {
  if (markdown.trim().length === 0) {
    return null;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={previewMarkdownComponents}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function MarkdownTableCell({ markdown }: { markdown: string }) {
  if (markdown.length === 0) {
    return null;
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={previewMarkdownComponents}>
      {markdown}
    </ReactMarkdown>
  );
}
