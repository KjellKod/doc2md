import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

function renderFindHighlight(source: string, match: FindMatch | null) {
  if (!match) {
    return source;
  }

  if (match.start === match.end) {
    return (
      <>
        {source.slice(0, match.start)}
        <mark className="markdown-find-highlight markdown-find-highlight-zero">
          {" "}
        </mark>
        {source.slice(match.end)}
      </>
    );
  }

  return (
    <>
      {source.slice(0, match.start)}
      <mark className="markdown-find-highlight">
        {source.slice(match.start, match.end)}
      </mark>
      {source.slice(match.end)}
    </>
  );
}

function scrollTextareaToMatch(
  textarea: HTMLTextAreaElement,
  source: string,
  match: FindMatch,
) {
  textarea.setSelectionRange(match.start, match.end);

  const linesBeforeMatch = source.slice(0, match.start).split("\n").length;
  const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight);
  const estimatedLineHeight = Number.isFinite(lineHeight) ? lineHeight : 20;
  const lineTop = (linesBeforeMatch - 1) * estimatedLineHeight;
  const targetScroll =
    lineTop - (textarea.clientHeight - estimatedLineHeight) / 2;

  textarea.scrollTop = clampScrollTop(textarea, targetScroll);
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

function clearRenderedFindHighlight(root: HTMLElement) {
  const highlights = Array.from(
    root.querySelectorAll("mark.markdown-rendered-find-highlight"),
  );

  for (const highlight of highlights) {
    if (highlight.classList.contains("markdown-rendered-find-highlight-zero")) {
      highlight.remove();
      continue;
    }

    highlight.replaceWith(...Array.from(highlight.childNodes));
  }

  root.normalize();
  removeEmptyRenderedInlineElements(root);
}

function removeEmptyRenderedInlineElements(root: HTMLElement) {
  const elements = Array.from(root.querySelectorAll("strong, em, span"));

  for (const element of elements) {
    if (element.textContent === "" && element.children.length === 0) {
      element.remove();
    }
  }
}

function textNodesFor(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return nodes;
}

function findTextPosition(root: HTMLElement, offset: number) {
  let cursor = 0;

  for (const node of textNodesFor(root)) {
    const nextCursor = cursor + node.data.length;

    if (offset >= cursor && offset <= nextCursor) {
      return { node, offset: offset - cursor };
    }

    cursor = nextCursor;
  }

  return null;
}

function applyRenderedFindHighlight(
  root: HTMLElement,
  match: FindMatch,
  centerMatch: boolean,
) {
  const start = findTextPosition(root, match.start);
  const end = findTextPosition(root, match.end);

  if (!start || !end) {
    return;
  }

  const highlight = document.createElement("mark");
  highlight.className = "markdown-rendered-find-highlight";

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  if (match.start === match.end) {
    highlight.classList.add("markdown-rendered-find-highlight-zero");
    highlight.textContent = "\u200b";
    range.insertNode(highlight);
  } else {
    highlight.append(range.extractContents());
    range.insertNode(highlight);
  }

  removeEmptyRenderedInlineElements(root);
  if (centerMatch) {
    centerElementInScrollContainer(root, highlight);
  }
}

export default function PreviewPanel({
  entry,
  onMarkdownChange,
  onSave,
  saveBusy = false,
  saveDisabled = false,
  saveKeyShortcuts,
  saveState = "saved",
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
  const pendingAnchorLineRef = useRef<number | null>(null);
  const suppressMatchCenteringForModeSwitchRef = useRef(false);
  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  useEffect(() => {
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
    setActiveFindMatch(null);
    setRenderedViewText("");
    pendingAnchorLineRef.current = null;
    suppressMatchCenteringForModeSwitchRef.current = false;
  }, [entry?.id, entry?.isScratch]);

  useEffect(() => {
    if (!findCapable && isFindOpen) {
      setIsFindOpen(false);
      setActiveFindMatch(null);
    }
  }, [findCapable, isFindOpen]);

  useEffect(() => {
    if (mode !== "edit" && showReplace) {
      setShowReplace(false);
    }
  }, [mode, showReplace]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  useEffect(() => {
    if (
      editorFocusRequestId === undefined ||
      editorFocusRequestId === 0 ||
      editorFocusRequestTarget !== "editor"
    ) {
      return;
    }

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
      const isReplaceShortcut =
        key === "f" && event.metaKey && event.altKey;

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
      if (isReplaceShortcut && mode === "edit") {
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
  const previewWithLineMap = formatPreviewMarkdownWithLineMap(effectiveMarkdown);
  const previewMarkdown = previewWithLineMap.markdown;
  const previewOriginalLineFor = previewWithLineMap.originalLineFor;
  const linkedinRefusal =
    mode === "linkedin"
      ? detectUnsupportedConstructs(effectiveMarkdown)
      : null;
  const linkedinWithLineMap =
    linkedinRefusal === null && mode === "linkedin"
      ? formatLinkedInUnicodeWithLineMap(effectiveMarkdown)
      : null;
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

    const nextText = element.textContent ?? "";
    setRenderedViewText((current) => (current === nextText ? current : nextText));
  }, [effectiveMarkdown, isFindOpen, linkedinPreview, mode, previewMarkdown]);

  useLayoutEffect(() => {
    const element = renderedViewRef.current;

    if (!element || mode === "edit") {
      return;
    }

    clearRenderedFindHighlight(element);

    if (isFindOpen && activeFindMatch) {
      applyRenderedFindHighlight(
        element,
        activeFindMatch,
        pendingAnchorLineRef.current === null &&
          shouldCenterActiveMatch(),
      );
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
    if (
      mode === "edit" &&
      isFindOpen &&
      activeFindMatch &&
      textareaRef.current &&
      pendingAnchorLineRef.current === null &&
      shouldCenterActiveMatch()
    ) {
      scrollTextareaToMatch(textareaRef.current, effectiveMarkdown, activeFindMatch);
      syncFindHighlightScroll();
    }
  }, [
    activeFindMatch?.end,
    activeFindMatch?.start,
    activeFindMatch,
    effectiveMarkdown,
    isFindOpen,
    mode,
  ]);

  useLayoutEffect(() => {
    const anchorLine = pendingAnchorLineRef.current;

    if (anchorLine === null) {
      return;
    }

    if (mode === "edit" && textareaRef.current) {
      scrollTextareaToLine(
        textareaRef.current,
        findHighlightRef.current,
        effectiveMarkdown,
        anchorLine,
      );
      syncFindHighlightScroll();
      pendingAnchorLineRef.current = null;
      window.setTimeout(() => {
        suppressMatchCenteringForModeSwitchRef.current = false;
      }, 0);
      return;
    }

    if (mode !== "edit" && renderedViewRef.current) {
      scrollRenderedToLine(renderedViewRef.current, anchorLine);
      pendingAnchorLineRef.current = null;
      window.setTimeout(() => {
        suppressMatchCenteringForModeSwitchRef.current = false;
      }, 0);
    }
  }, [activeFindMatch, effectiveMarkdown, mode]);

  if (!entry) {
    return (
      <div className="preview-empty-state">
        <p className="empty-state-title">Start with writing or drop a file.</p>
        <p className="empty-state-copy">
          Open the editor to paste or write Markdown from scratch, or convert a
          document and review the result here.
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

  function captureAnchorLine(): number | null {
    if (mode === "edit" && textareaRef.current) {
      return topLineFromTextareaMirror(
        textareaRef.current,
        findHighlightRef.current,
        effectiveMarkdown,
      );
    }

    if (mode !== "edit" && renderedViewRef.current) {
      return topLineFromRendered(renderedViewRef.current);
    }

    return null;
  }

  function switchMode(nextMode: "edit" | "preview" | "linkedin") {
    if (nextMode === mode) {
      return;
    }

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
    setShowReplace(replace && mode === "edit");
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

  function handleEditorScroll() {
    if (!textareaRef.current) {
      return;
    }

    syncFindHighlightScroll();
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
      <div className="markdown-edit-shell">
        <pre
          ref={findHighlightRef}
          className="markdown-find-overlay"
          aria-hidden="true"
        >
          {renderFindHighlight(
            effectiveMarkdown,
            isFindOpen ? activeFindMatch : null,
          )}
        </pre>
        <textarea
          ref={textareaRef}
          className="markdown-edit-area"
          value={effectiveMarkdown}
          onChange={(event) => onMarkdownChange?.(event.target.value)}
          onScroll={handleEditorScroll}
          aria-label="Edit markdown"
        />
      </div>
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
          {(linkedinPreview ?? "").split("\n").map((line, lineIndex, all) => {
            const sourceLine =
              linkedinOriginalLineFor[lineIndex] ?? lineIndex + 1;
            const segments = segmentLinkedInPreview(line);
            return (
              <span key={`linkedin-line-${lineIndex}`}>
                <span
                  className="linkedin-line"
                  data-source-line={String(sourceLine)}
                >
                  {segments.map(({ text, tone }, segmentIndex) =>
                    tone ? (
                      <span
                        key={`${tone}-${segmentIndex}`}
                        className={`linkedin-emphasis linkedin-emphasis-${tone}`}
                      >
                        {text}
                      </span>
                    ) : (
                      <span key={`plain-${segmentIndex}`}>{text}</span>
                    ),
                  )}
                </span>
                {lineIndex < all.length - 1 ? "\n" : null}
              </span>
            );
          })}
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
          rehypePlugins={[sourceLineRehype(previewOriginalLineFor)]}
        >
          {previewMarkdown}
        </ReactMarkdown>
      </div>
    );

  return (
    <div className="preview-body">
      {showToggle || showCopyButton || onSave ? (
        <div className="preview-toolbar">
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
                <SaveStatePill state={saveState} />
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
