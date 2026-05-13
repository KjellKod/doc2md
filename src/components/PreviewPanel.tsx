import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FilePlus, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileEntry } from "../types";
import type { SaveState } from "../types/saveState";
import { entryDisplayName } from "../utils/displayName";
import ErrorMessage from "./ErrorMessage";
import {
  detectUnsupportedConstructs,
  formatLinkedInUnicodeWithLineMap,
} from "./linkedinFormatting";
import PdfQualityIndicator from "./PdfQualityIndicator";
import { formatPreviewMarkdownWithLineMap } from "./previewFormatting";
import { findHighlightRehype } from "./findHighlightRehype";
import { sourceLineRehype } from "./sourceLineRehype";
import {
  scrollRenderedToLine,
  scrollTextareaToLine,
  topLineFromRendered,
  topLineFromTextareaMirror,
} from "./viewportAnchor";
import SaveButton from "./SaveButton";
import SaveStatePill from "./SaveStatePill";
import FindReplaceBar from "./FindReplaceBar";
import type { FindMatch } from "./useFindReplace";
import EditMode from "./preview/EditMode";

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

const UNDERLINE_MARK = "\u0332";
const STRIKE_MARK = "\u0336";

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

interface PreviewPanelProps {
  entry: FileEntry | null;
  onMarkdownChange?: (markdown: string) => void;
  onSave?: () => void | Promise<void>;
  saveBusy?: boolean;
  saveDisabled?: boolean;
  saveKeyShortcuts?: string;
  saveState?: SaveState;
  /** Epoch ms of the most recent successful save. Drives the relative-time
   *  status label "Saved · Ns ago". */
  lastSavedAt?: number | null;
  onStartWriting?: () => void;
  onNewDocument?: () => void;
  editorFocusRequest?: { id: number; target: "editor" };
}

function fallbackCopyText(text: string) {
  const element = document.createElement("textarea");
  element.value = text;
  element.setAttribute("readonly", "");
  element.style.position = "absolute";
  element.style.left = "-9999px";
  document.body.appendChild(element);
  element.select();
  document.execCommand("copy");
  document.body.removeChild(element);
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

export default function PreviewPanel({
  entry,
  onMarkdownChange,
  onSave,
  saveBusy = false,
  saveDisabled = false,
  saveKeyShortcuts,
  saveState = "saved",
  lastSavedAt = null,
  onStartWriting,
  onNewDocument,
  editorFocusRequest,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview" | "linkedin">("preview");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [activeFindMatch, setActiveFindMatch] = useState<FindMatch | null>(null);
  const [renderedViewText, setRenderedViewText] = useState("");
  const [findFocusRequest, setFindFocusRequest] = useState<{
    id: number;
    target: "find" | "replace";
  }>({ id: 0, target: "find" });
  const editorFocusRequestId = editorFocusRequest?.id;
  const editorFocusRequestTarget = editorFocusRequest?.target;
  const previewRef = useRef<HTMLDivElement | null>(null);
  const renderedViewRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const findHighlightRef = useRef<HTMLPreElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const pendingAnchorLineRef = useRef<number | null>(null);
  const suppressMatchCenteringForModeSwitchRef = useRef(false);
  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  // Reset everything when the active entry changes: mode, find bar, active
  // match, rendered-view snapshot, and two pendingAnchor refs. The five
  // updates are coupled — splitting them across during-render setStates
  // would risk inconsistent transient states.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entry-change reset (see comment above)
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
    setActiveFindMatch(null);
    setRenderedViewText("");
    pendingAnchorLineRef.current = null;
    suppressMatchCenteringForModeSwitchRef.current = false;
  }, [entry?.id, entry?.isScratch]);

  // Close the find bar when the entry stops being findCapable (e.g.
  // conversion errors out). Two coupled setStates; keep them in an effect
  // so the find UI tears down atomically after the capability flip.
  useEffect(() => {
    if (!findCapable && isFindOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- find-capability reset (see comment above)
      setIsFindOpen(false);
      setActiveFindMatch(null);
    }
  }, [findCapable, isFindOpen]);

  // React 19: drop showReplace during render when the mode is no longer
  // edit. Single guarded setState, no other coupled effects.
  if (mode !== "edit" && showReplace) {
    setShowReplace(false);
  }

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  // Switch to edit mode and focus the textarea when a focus request fires.
  // The setMode call is coupled to a setTimeout that schedules the focus;
  // moving the setState to during-render would re-queue the timer on every
  // render. Keep both inside the effect, gated on focus-request id change.
  useEffect(() => {
    if (
      editorFocusRequestId === undefined ||
      editorFocusRequestId === 0 ||
      editorFocusRequestTarget !== "editor"
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- focus-request handler (see comment above)
    setMode("edit");
    const timeoutId = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [editorFocusRequestId, editorFocusRequestTarget]);

  useEffect(() => {
    function handleFindShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isFindShortcut =
        key === "f" &&
        ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey));
      // Replace shortcut: Cmd-Alt-F (macOS muscle memory) OR Ctrl-Alt-F
      // (Linux/Windows). Mirrors the cross-platform handling above.
      const isReplaceShortcut =
        key === "f" &&
        event.altKey &&
        ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey));

      if (!isFindShortcut && !isReplaceShortcut) {
        return;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest("[data-find-replace-bar]")
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (!findCapable) {
        return;
      }

      event.preventDefault();
      setIsFindOpen(true);
      // In edit mode, default to showing Replace so users see all the
      // controls at once and can hide them via the existing toggle.
      // The Cmd-Alt-F shortcut still forces Replace open for keyboard
      // muscle memory.
      if (mode === "edit" || isReplaceShortcut) {
        setShowReplace(true);
      } else if (!isFindOpen) {
        setShowReplace(false);
      }
      setFindFocusRequest(({ id }) => ({
        id: id + 1,
        target: isReplaceShortcut && mode === "edit" ? "replace" : "find",
      }));
    }

    window.addEventListener("keydown", handleFindShortcut);

    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, [findCapable, isFindOpen, mode]);

  const effectiveMarkdown = entry?.editedMarkdown ?? entry?.markdown ?? "";
  const canEditFromEmptyState = Boolean(
    entry && (entry.isScratch || entry.editedMarkdown !== undefined),
  );
  // Heavy work: full-document parsing, line-mapping, refusal scanning,
  // and rehype plugin instantiation. Memoize on `effectiveMarkdown`
  // (and mode where applicable) so a parent re-render — including a
  // mode switch that doesn't change the source — does not re-parse
  // the whole document. Without these memos a multi-thousand-line
  // doc takes several seconds to switch into preview because every
  // render builds a fresh rehype plugin reference, which busts
  // ReactMarkdown's internal parse cache.
  const previewWithLineMap = useMemo(
    () => formatPreviewMarkdownWithLineMap(effectiveMarkdown),
    [effectiveMarkdown],
  );
  const previewMarkdown = previewWithLineMap.markdown;
  const previewOriginalLineFor = previewWithLineMap.originalLineFor;
  const renderedFindHighlightMatch = useMemo(
    () =>
      mode !== "edit" && isFindOpen && activeFindMatch
        ? { start: activeFindMatch.start, end: activeFindMatch.end }
        : null,
    [activeFindMatch, isFindOpen, mode],
  );
  const previewRehypePlugins = useMemo(
    () => [
      sourceLineRehype(previewOriginalLineFor),
      findHighlightRehype(renderedFindHighlightMatch),
    ],
    [previewOriginalLineFor, renderedFindHighlightMatch],
  );
  const linkedinRefusal = useMemo(
    () =>
      mode === "linkedin" ? detectUnsupportedConstructs(effectiveMarkdown) : null,
    [effectiveMarkdown, mode],
  );
  const linkedinWithLineMap = useMemo(
    () =>
      linkedinRefusal === null && mode === "linkedin"
        ? formatLinkedInUnicodeWithLineMap(effectiveMarkdown)
        : null,
    [effectiveMarkdown, linkedinRefusal, mode],
  );
  const linkedinPreview = linkedinWithLineMap?.text ?? null;
  const linkedinOriginalLineFor = linkedinWithLineMap?.originalLineFor ?? [];
  const showToggle = Boolean(
    entry &&
      (entry.status === "success" || entry.status === "warning") &&
      (entry.markdown.length > 0 || canEditFromEmptyState),
  );
  const copyText =
    mode === "linkedin"
      ? linkedinRefusal
        ? null
        : linkedinPreview
      : effectiveMarkdown;
  const showCopyButton = showToggle && typeof copyText === "string";
  const activeFindSource =
    mode === "edit" ? effectiveMarkdown : renderedViewText;

  function shouldCenterActiveMatch() {
    return !suppressMatchCenteringForModeSwitchRef.current;
  }

  useLayoutEffect(() => {
    const element = renderedViewRef.current;

    if (!element || mode === "edit") {
      setRenderedViewText("");
      return;
    }

    // The find-highlight rehype plugin inserts a zero-width <mark> (with
    // a U+200B sentinel character) for zero-width regex matches. Strip
    // U+200B from the snapshot so renderedViewText reflects what the
    // user perceives as the searchable corpus — otherwise the sentinel
    // would shift offsets for subsequent find queries (bug 2 reviewer-B
    // finding).
    const nextText = (element.textContent ?? "").replace(/\u200B/g, "");
    setRenderedViewText((current) => (current === nextText ? current : nextText));
  }, [effectiveMarkdown, isFindOpen, linkedinPreview, mode, previewMarkdown]);

  // Center the active match within the rendered surface AFTER the rehype
  // plugin has injected the <mark>. This is a READ of React-rendered DOM,
  // never a mutation — the bug previously fixed via direct DOM mutation
  // (which corrupted React's tree) now lives in `findHighlightRehype`.
  useLayoutEffect(() => {
    const element = renderedViewRef.current;
    if (!element || mode === "edit") {
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
    mode,
    renderedViewText,
  ]);

  useLayoutEffect(() => {
    const anchorLine = pendingAnchorLineRef.current;

    if (anchorLine === null) {
      return;
    }

    const floor = viewportTopFloor();

    if (mode === "edit" && textareaRef.current) {
      scrollTextareaToLine(
        textareaRef.current,
        findHighlightRef.current,
        effectiveMarkdown,
        anchorLine,
        floor,
      );
      syncFindHighlightScroll();
      pendingAnchorLineRef.current = null;
      window.setTimeout(() => {
        suppressMatchCenteringForModeSwitchRef.current = false;
      }, 0);
      return;
    }

    if (mode !== "edit" && renderedViewRef.current) {
      scrollRenderedToLine(renderedViewRef.current, anchorLine, floor);
      pendingAnchorLineRef.current = null;
      window.setTimeout(() => {
        suppressMatchCenteringForModeSwitchRef.current = false;
      }, 0);
    }
  }, [activeFindMatch, effectiveMarkdown, mode]);

  if (!entry) {
    const emptyStateInteractive = Boolean(onStartWriting);
    return (
      <div
        className={`preview-empty-state${emptyStateInteractive ? " preview-empty-state-interactive" : ""}`}
        role={emptyStateInteractive ? "button" : undefined}
        tabIndex={emptyStateInteractive ? 0 : undefined}
        onClick={(event) => {
          if (!onStartWriting) {
            return;
          }
          // Let inner buttons handle their own clicks (the Start
          // writing button below); otherwise treat the click anywhere
          // in the empty area as "open the editor".
          const target = event.target as Element | null;
          if (target?.closest("button, a, input, textarea, label")) {
            return;
          }
          onStartWriting();
        }}
        onKeyDown={(event) => {
          if (!onStartWriting) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onStartWriting();
          }
        }}
      >
        <p className="empty-state-title">Start with writing or drop a file.</p>
        <p className="empty-state-copy">
          Open the editor to paste or write Markdown from scratch, or convert a
          document and review the result here. Click anywhere here to start
          writing.
        </p>
        {onStartWriting ? (
          <div className="empty-state-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onStartWriting}
            >
              Start writing
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (entry.status === "pending" || entry.status === "converting") {
    return (
      <div className="preview-empty-state preview-loading-state" role="status">
        <span className="loading-orb" aria-hidden="true" />
        <p className="empty-state-title">Converting locally.</p>
        <p className="empty-state-copy">
          Preparing a Markdown preview for {entryDisplayName(entry)}.
        </p>
      </div>
    );
  }

  if (entry.status === "error") {
    if (entry.format === "pdf" && entry.quality) {
      return (
        <div className="preview-body">
          <PdfQualityIndicator quality={entry.quality} />
          <ErrorMessage message={entry.warnings[0] ?? "Conversion failed."} />
        </div>
      );
    }

    return <ErrorMessage message={entry.warnings[0] ?? "Conversion failed."} />;
  }

  if (entry.markdown.length === 0 && !canEditFromEmptyState) {
    return (
      <div className="preview-empty-state">
        <p className="empty-state-title">No Markdown output.</p>
        <p className="empty-state-copy">
          This file finished processing, but there is nothing useful to render.
        </p>
      </div>
    );
  }

  function viewportTopFloor(): number {
    return toolbarRef.current?.getBoundingClientRect().bottom ?? 0;
  }

  function captureAnchorLine(): number | null {
    const floor = viewportTopFloor();

    if (mode === "edit" && textareaRef.current) {
      return topLineFromTextareaMirror(
        textareaRef.current,
        findHighlightRef.current,
        effectiveMarkdown,
        floor,
      );
    }

    if (mode !== "edit" && renderedViewRef.current) {
      return topLineFromRendered(renderedViewRef.current, floor);
    }

    return null;
  }

  function switchMode(nextMode: "edit" | "preview" | "linkedin") {
    if (nextMode === mode) {
      return;
    }

    // Note: no DOM-mutation cleanup needed anymore. The find highlight
    // is rendered through the `findHighlightRehype` rehype plugin so
    // React owns the `<mark>` wrapper from creation to unmount; there
    // are no orphaned mutations to clean up before a mode switch.

    const captured = captureAnchorLine();
    if (captured !== null) {
      pendingAnchorLineRef.current = captured;
    }
    // If we can't capture (e.g. linkedin refusal screen has no rendered
    // ref), preserve any existing pending anchor so the user lands back
    // at where they were before the refusal interlude.
    suppressMatchCenteringForModeSwitchRef.current = activeFindMatch !== null;
    setMode(nextMode);
  }

  function openFind(replace = false) {
    setIsFindOpen(true);
    // Show Replace by default in edit mode; toolbar Find button passes
    // replace=false but we still expose Replace because the user is
    // already in edit mode and likely needs both.
    setShowReplace(mode === "edit" || replace);
    setFindFocusRequest(({ id }) => ({
      id: id + 1,
      target: replace && mode === "edit" ? "replace" : "find",
    }));
  }

  function closeFind() {
    setIsFindOpen(false);
    setActiveFindMatch(null);
  }

  function syncFindHighlightScroll() {
    if (!textareaRef.current || !findHighlightRef.current) {
      return;
    }

    findHighlightRef.current.scrollTop = textareaRef.current.scrollTop;
    findHighlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  async function copyRenderedContent() {
    const previewElement = previewRef.current;

    if (!previewElement) {
      return false;
    }

    const html = previewElement.innerHTML;
    const plain = previewElement.innerText;

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Rich clipboard is unavailable");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
    } catch {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(plain);
        } else {
          fallbackCopyText(plain);
        }
      } catch {
        fallbackCopyText(plain);
      }
    }

    return true;
  }

  async function handleCopy() {
    if (!copyText) {
      return;
    }

    if (mode === "preview") {
      if (await copyRenderedContent()) {
        setCopyState("copied");
      }

      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        fallbackCopyText(copyText);
      }

      setCopyState("copied");
    } catch {
      fallbackCopyText(copyText);
      setCopyState("copied");
    }
  }

  const showQualityIndicator = entry.format === "pdf" && entry.quality;
  const body =
    mode === "edit" ? (
      <EditMode
        effectiveMarkdown={effectiveMarkdown}
        isFindOpen={isFindOpen}
        activeFindMatch={activeFindMatch}
        textareaRef={textareaRef}
        findHighlightRef={findHighlightRef}
        pendingAnchorLineRef={pendingAnchorLineRef}
        suppressMatchCenteringForModeSwitchRef={
          suppressMatchCenteringForModeSwitchRef
        }
        viewportTopFloor={viewportTopFloor}
        onMarkdownChange={onMarkdownChange}
      />
    ) : mode === "linkedin" ? (
      linkedinRefusal ? (
        <div className="linkedin-refusal" role="status">
          <p>{linkedinRefusal}</p>
          <p>
            Remove tables or HTML from this draft to preview a LinkedIn-ready
            plain-text version.
          </p>
        </div>
      ) : (
        <pre
          ref={(element) => {
            renderedViewRef.current = element;
          }}
          className="linkedin-surface"
          aria-label="LinkedIn preview"
        >
          {(() => {
            const lines = (linkedinPreview ?? "").split("\n");
            // Compute the absolute offset of each line's first character in
            // the rendered textContent so we can intersect the active find
            // match (which uses rendered-text offsets — see
            // `findHighlightRehype` and the `renderedViewText` snapshot) and
            // wrap the matching span in <mark> declaratively. The old DOM-
            // mutation path also highlighted LinkedIn mode; the new rehype-
            // plugin path only covers Preview, so LinkedIn parity is restored
            // here without mutating React-managed DOM.
            let cursor = 0;
            const lineStarts = lines.map((line) => {
              const start = cursor;
              cursor += line.length + 1;
              return start;
            });
            return lines.map((line, lineIndex, all) => {
              const sourceLine =
                linkedinOriginalLineFor[lineIndex] ?? lineIndex + 1;
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
      )
    ) : (
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

  return (
    <div className="preview-body">
      {showToggle || showCopyButton || onSave ? (
        <div ref={toolbarRef} className="preview-toolbar">
          {showToggle ? (
            <div
              className="preview-toggle"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                className={`preview-toggle-button${mode === "edit" ? " is-active" : ""}`}
                onClick={() => switchMode("edit")}
                aria-pressed={mode === "edit"}
              >
                Edit
              </button>
              <button
                type="button"
                className={`preview-toggle-button${mode === "preview" ? " is-active" : ""}`}
                onClick={() => switchMode("preview")}
                aria-pressed={mode === "preview"}
              >
                Preview
              </button>
              <div className="preview-toggle-with-tooltip">
                <button
                  type="button"
                  className={`preview-toggle-button${mode === "linkedin" ? " is-active" : ""}`}
                  onClick={() => switchMode("linkedin")}
                  aria-pressed={mode === "linkedin"}
                  aria-describedby="linkedin-toggle-tooltip"
                >
                  LinkedIn
                </button>
                <span
                  id="linkedin-toggle-tooltip"
                  role="tooltip"
                  className="preview-toggle-tooltip"
                >
                  Unicode formatting for easy LinkedIn posting
                </span>
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="preview-toolbar-actions">
            {onNewDocument ? (
              <button
                type="button"
                className="ghost-button find-entry-button"
                onClick={onNewDocument}
                aria-label="New document"
              >
                <FilePlus className="find-entry-icon" aria-hidden="true" />
                <span className="find-entry-label">New</span>
              </button>
            ) : null}
            {showToggle ? (
              <button
                type="button"
                className="find-entry-button"
                onClick={() => openFind(false)}
                aria-label="Find and replace"
                aria-keyshortcuts="Meta+F Control+F"
              >
                <Search className="find-entry-icon" aria-hidden="true" />
                <span className="find-entry-label">Find</span>
              </button>
            ) : null}
            {onSave ? (
              <div className="save-control-group">
                <SaveButton
                  onSave={onSave}
                  disabled={saveDisabled}
                  busy={saveBusy}
                  ariaKeyshortcuts={saveKeyShortcuts}
                />
                <SaveStatePill state={saveState} lastSavedAt={lastSavedAt} />
              </div>
            ) : null}
            {showCopyButton ? (
              <div className="preview-actions">
                <button
                  type="button"
                  className="preview-copy-button"
                  onClick={handleCopy}
                  aria-label={
                    mode === "preview"
                      ? "Copy formatted text"
                      : mode === "linkedin"
                        ? "Copy LinkedIn text"
                        : "Copy markdown document"
                  }
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="preview-copy-icon"
                  >
                    <rect x="9" y="7" width="10" height="12" rx="2" />
                    <rect x="5" y="3" width="10" height="12" rx="2" />
                  </svg>
                </button>
                <span
                  className={`preview-copy-tooltip${copyState === "copied" ? " is-visible" : ""}`}
                  aria-live="polite"
                >
                  {copyState === "copied" ? "Copied" : "Copy"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

          {isFindOpen ? (
            <FindReplaceBar
              source={activeFindSource}
              onSourceChange={(nextMarkdown) => onMarkdownChange?.(nextMarkdown)}
              textareaRef={mode === "edit" ? textareaRef : undefined}
              onClose={closeFind}
              showReplace={showReplace}
              onShowReplaceChange={setShowReplace}
              allowReplace={mode === "edit"}
              focusRequest={findFocusRequest}
              onActiveMatchChange={setActiveFindMatch}
            />
          ) : null}

      {showQualityIndicator ? (
        <PdfQualityIndicator quality={entry.quality!} />
      ) : null}

      {entry.warnings.length > 0 ? (
        <div className="warning-message" role="status">
          {entry.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {body}
    </div>
  );
}
