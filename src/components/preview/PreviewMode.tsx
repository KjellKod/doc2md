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
import {
  replaceTaskMarkerAtSourceLine,
  replaceTaskMarkerByIndex,
} from "./taskCheckboxSource";
import { tableTaskCheckboxRehype } from "../../render/tableTaskCheckboxRehype";
import {
  enumerateRowMarkers,
  type CellMarker,
} from "./tableCellCheckbox";
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
  onTaskCheckboxToggle?: (
    sourceLine: number,
    checked: boolean,
    markerIndex: number | null,
  ) => void,
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

      // Table-cell inputs carry data-task-marker-index; list inputs do not.
      // Defensive int parse: anything that does not parse routes to the legacy
      // list path (review finding arb-it1-2).
      const markerIndexValue = (props as Record<string, unknown>)[
        "data-task-marker-index"
      ];
      const parsedMarkerIndex =
        typeof markerIndexValue === "string"
          ? Number.parseInt(markerIndexValue, 10)
          : Number.NaN;
      const markerIndex = Number.isInteger(parsedMarkerIndex)
        ? parsedMarkerIndex
        : null;

      return (
        <input
          {...props}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={false}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onTaskCheckboxToggle(
              taskSourceLine,
              event.currentTarget.checked,
              markerIndex,
            )
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
          ? (sourceLine, checked, markerIndex) => {
              // Dispatch by attribute presence: table-cell inputs carry a valid
              // markerIndex and route to the index-aware path; list inputs have
              // no index and route to the unchanged legacy path (plan §4.2).
              const nextMarkdown =
                markerIndex === null
                  ? replaceTaskMarkerAtSourceLine(
                      effectiveMarkdown,
                      sourceLine,
                      checked,
                    )
                  : replaceTaskMarkerByIndex(
                      effectiveMarkdown,
                      sourceLine,
                      markerIndex,
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
          // Synthesize static table-cell checkbox inputs (same plugin as
          // export, parity by construction). The resolver maps a row's
          // FORMATTED start line back to the ORIGINAL source line via the line
          // map, then reads the original line — the same string write-back
          // edits, so render index and edited span stay consistent (plan §4.1).
          tableTaskCheckboxRehype({
            resolveRowSourceLine: (formattedLine) => {
              const originalLine =
                previewWithLineMap.originalLineFor[formattedLine - 1] ??
                formattedLine;
              const lines = effectiveMarkdown.split(/\r\n|\n|\r/u);
              const line = lines[originalLine - 1];
              return line === undefined ? null : line;
            },
          }),
          sourceLineRehype(previewWithLineMap.originalLineFor),
          findHighlight,
        ],
    [effectiveMarkdown, findHighlight, previewWithLineMap],
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

  // Wire interactive table-cell checkboxes into the large-document fallback
  // path so behavior matches RichPreviewMode (finding
  // arb-large-doc-table-checkbox-doc-gap-1). The fallback renders the table
  // manually (not via ReactMarkdown), so the tableTaskCheckboxRehype plugin
  // never runs here. Instead we reuse the SAME canonical enumerator
  // (enumerateRowMarkers) on the row's ORIGINAL raw source line — the exact
  // string write-back edits — so render-side marker indices and the write-back
  // span cannot drift. row.sourceLine is the original 1-based source line
  // (parseDominantMarkdownTable indexes the original markdown, not a formatted
  // copy), so no formatted->original mapping is required and the source line is
  // always accurate. Write-back routes through the same replaceTaskMarkerByIndex
  // used by the rich path; replaceTaskMarkerAtSourceLine stays byte-for-byte
  // untouched.
  // Split the SAME way parseDominantMarkdownTable does (/\r?\n/) so the line we
  // read for marker enumeration matches the row.sourceLine it assigned. The
  // marker offsets are only ever used relative to this line; write-back then
  // re-derives the line from row.sourceLine inside replaceTaskMarkerByIndex.
  const rawSourceLines = useMemo(
    () => effectiveMarkdown.split(/\r?\n/u),
    [effectiveMarkdown],
  );
  const handleTableCheckboxToggle = useMemo(
    () =>
      onMarkdownChange
        ? (sourceLine: number, markerIndex: number, checked: boolean) => {
            const nextMarkdown = replaceTaskMarkerByIndex(
              effectiveMarkdown,
              sourceLine,
              markerIndex,
              checked,
            );
            if (nextMarkdown !== effectiveMarkdown) {
              onMarkdownChange(nextMarkdown);
            }
          }
        : undefined,
    [effectiveMarkdown, onMarkdownChange],
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
  const rowHeight = 72;
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
          <tr data-source-line={table.tableStartLine}>
            {(() => {
              const headerMarkers = rowCellMarkers(
                rawSourceLines[table.tableStartLine - 1],
                table.header.length,
              );
              return table.header.map((cell, index) => (
                <th
                  key={`${index}-${cell}`}
                  style={{ textAlign: table.alignments[index] ?? undefined }}
                >
                  <FallbackTableCell
                    markdown={cell}
                    marker={headerMarkers.get(index)}
                    sourceLine={table.tableStartLine}
                    onToggle={handleTableCheckboxToggle}
                  />
                </th>
              ));
            })()}
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
          {visibleRows.map((row) => {
            const markers = rowCellMarkers(
              rawSourceLines[row.sourceLine - 1],
              row.cells.length,
            );
            return (
              <tr key={row.sourceLine} data-source-line={row.sourceLine}>
                {Array.from({ length: columnCount }, (_, index) => (
                  <td
                    key={index}
                    style={{ textAlign: table.alignments[index] ?? undefined }}
                  >
                    <FallbackTableCell
                      markdown={row.cells[index] ?? ""}
                      marker={markers.get(index)}
                      sourceLine={row.sourceLine}
                      onToggle={handleTableCheckboxToggle}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
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

// Resolve the synthesizable checkbox markers for one fallback-path table row.
// Runs the canonical enumerator on the row's raw source line, then applies a
// raw-cell-count vs rendered-cell-count fail-safe: if the canonical splitter
// disagrees with the fallback's own cell split, the cell<->marker mapping is
// untrustworthy and the row is left fully literal. Returns a map keyed by
// cellIndex.
//
// NOTE on the fail-safe's reach in this path: unlike the rich path — where the
// fail-safe compares the raw split against remark-gfm's authoritative <td>
// boundaries — the fallback has no remark-gfm row parse. Both the rendered
// cells (parseDominantMarkdownTable) and the markers (enumerateRowMarkers) come
// from naive unescaped-pipe splitters that agree even on a pipe-in-inline-code
// row, so this guard will not skip that case the way the rich path does. This
// is still SAFE for write-back: replaceTaskMarkerByIndex re-runs the SAME
// enumerator on the SAME raw line, so the toggled span is always a genuine
// `[ ]`/`[x]` marker offset — never a wrong-byte mutation. The only residual
// effect is a possible checkbox where GFM would render differently; the byte
// edited is always a real marker. Correctness (no wrong-byte write-back) is
// preserved; completeness against exotic inline-code rows is not guaranteed.
function rowCellMarkers(
  rawSourceLine: string | undefined,
  renderedCellCount: number,
): Map<number, CellMarker> {
  const result = new Map<number, CellMarker>();
  if (rawSourceLine === undefined) {
    return result;
  }
  const { markers, rawCellCount } = enumerateRowMarkers(rawSourceLine);
  if (markers.length === 0 || rawCellCount !== renderedCellCount) {
    return result;
  }
  for (const marker of markers) {
    result.set(marker.cellIndex, marker);
  }
  return result;
}

// Render one fallback-path table cell. When a synthesized checkbox marker
// applies to this cell, render a real <input type="checkbox"> followed by the
// preserved trailing label (mirroring the rich path), wired to write-back when
// interactive. Otherwise render the cell content unchanged via MarkdownTableCell.
function FallbackTableCell({
  markdown,
  marker,
  sourceLine,
  onToggle,
}: {
  markdown: string;
  marker: CellMarker | undefined;
  sourceLine: number;
  onToggle?: (sourceLine: number, markerIndex: number, checked: boolean) => void;
}) {
  if (!marker) {
    return <MarkdownTableCell markdown={markdown} />;
  }

  // Strip the leading marker from the (already trimmed) cell text to recover the
  // trailing label, mirroring tableTaskCheckboxRehype.convertCell. The canonical
  // enumerator already approved this cell, so the leading form is present.
  const trimmed = markdown.trimStart();
  const markerMatch = /^(?:[-*+][ \t]+)?\[(?: |x|X)\]/u.exec(trimmed);
  const remainder = markerMatch ? trimmed.slice(markerMatch[0].length).trim() : "";
  const checked = marker.state === "checked";
  const ariaLabel = remainder
    ? `Toggle task: ${remainder.replace(/\s+/gu, " ")}`
    : `Toggle task on line ${sourceLine} (checkbox ${marker.markerIndex})`;

  return (
    <>
      <input
        type="checkbox"
        checked={checked}
        disabled={!onToggle}
        aria-label={ariaLabel}
        data-task-source-line={String(sourceLine)}
        data-task-marker-index={String(marker.markerIndex)}
        onChange={
          onToggle
            ? (event: ChangeEvent<HTMLInputElement>) =>
                onToggle(sourceLine, marker.markerIndex, event.currentTarget.checked)
            : undefined
        }
      />
      {remainder ? <MarkdownTableCell markdown={remainder} /> : null}
    </>
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
