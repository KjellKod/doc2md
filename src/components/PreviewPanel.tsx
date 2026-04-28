import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileEntry } from "../types";
import type { DesktopSaveState } from "../desktop/saveState";
import { entryDisplayName } from "../utils/displayName";
import ErrorMessage from "./ErrorMessage";
import {
  detectUnsupportedConstructs,
  formatLinkedInUnicode,
} from "./linkedinFormatting";
import PdfQualityIndicator from "./PdfQualityIndicator";
import { formatPreviewMarkdown } from "./previewFormatting";
import SaveButton from "./SaveButton";
import SaveStatePill from "./SaveStatePill";
import FindReplaceBar from "./FindReplaceBar";

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
  saveState?: DesktopSaveState;
  onStartWriting?: () => void;
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

export default function PreviewPanel({
  entry,
  onMarkdownChange,
  onSave,
  saveBusy = false,
  saveDisabled = false,
  saveKeyShortcuts,
  saveState = "saved",
  onStartWriting,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview" | "linkedin">("preview");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [findFocusRequest, setFindFocusRequest] = useState<{
    id: number;
    target: "find" | "replace";
  }>({ id: 0, target: "find" });
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  useEffect(() => {
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
  }, [entry?.id, entry?.isScratch]);

  useEffect(() => {
    if (!findCapable && isFindOpen) {
      setIsFindOpen(false);
    }
  }, [findCapable, isFindOpen]);

  useEffect(() => {
    if (mode !== "edit" && isFindOpen) {
      setIsFindOpen(false);
    }
  }, [isFindOpen, mode]);

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
    function handleFindShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isFindShortcut =
        key === "f" &&
        ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey));
      const isReplaceShortcut =
        (key === "f" && event.metaKey && event.altKey) ||
        (key === "h" && event.ctrlKey && !event.metaKey);

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
      setMode("edit");
      setIsFindOpen(true);
      if (isReplaceShortcut) {
        setShowReplace(true);
      } else if (!isFindOpen) {
        setShowReplace(false);
      }
      setFindFocusRequest(({ id }) => ({
        id: id + 1,
        target: isReplaceShortcut ? "replace" : "find",
      }));
    }

    window.addEventListener("keydown", handleFindShortcut);

    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, [findCapable, isFindOpen]);

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

  const effectiveMarkdown = entry.editedMarkdown ?? entry.markdown;
  const canEditFromEmptyState =
    entry.isScratch || entry.editedMarkdown !== undefined;

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

  const previewMarkdown = formatPreviewMarkdown(effectiveMarkdown);
  const linkedinRefusal =
    mode === "linkedin"
      ? detectUnsupportedConstructs(effectiveMarkdown)
      : null;
  const linkedinPreview = linkedinRefusal
    ? null
    : mode === "linkedin"
      ? formatLinkedInUnicode(effectiveMarkdown)
      : null;
  const showToggle =
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 || canEditFromEmptyState);
  const copyText =
    mode === "linkedin"
      ? linkedinRefusal
        ? null
        : linkedinPreview
      : effectiveMarkdown;
  const showCopyButton = showToggle && typeof copyText === "string";

  function openFind(replace = false) {
    setMode("edit");
    setIsFindOpen(true);
    setShowReplace(replace);
    setFindFocusRequest(({ id }) => ({
      id: id + 1,
      target: replace ? "replace" : "find",
    }));
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
      <textarea
        ref={textareaRef}
        className="markdown-edit-area"
        value={effectiveMarkdown}
        onChange={(event) => onMarkdownChange?.(event.target.value)}
        aria-label="Edit markdown"
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
        <pre className="linkedin-surface" aria-label="LinkedIn preview">
          {segmentLinkedInPreview(linkedinPreview ?? "").map(
            ({ text, tone }, index) =>
              tone ? (
                <span
                  key={`${tone}-${index}`}
                  className={`linkedin-emphasis linkedin-emphasis-${tone}`}
                >
                  {text}
                </span>
              ) : (
                <span key={`plain-${index}`}>{text}</span>
              ),
          )}
        </pre>
      )
    ) : (
      <div className="markdown-surface" ref={previewRef}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMarkdown}</ReactMarkdown>
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
                onClick={() => setMode("edit")}
                aria-pressed={mode === "edit"}
              >
                Edit
              </button>
              <button
                type="button"
                className={`preview-toggle-button${mode === "preview" ? " is-active" : ""}`}
                onClick={() => setMode("preview")}
                aria-pressed={mode === "preview"}
              >
                Preview
              </button>
              <div className="preview-toggle-with-tooltip">
                <button
                  type="button"
                  className={`preview-toggle-button${mode === "linkedin" ? " is-active" : ""}`}
                  onClick={() => setMode("linkedin")}
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

      {isFindOpen && mode === "edit" ? (
        <FindReplaceBar
          source={effectiveMarkdown}
          onSourceChange={(nextMarkdown) => onMarkdownChange?.(nextMarkdown)}
          textareaRef={textareaRef}
          onClose={() => setIsFindOpen(false)}
          showReplace={showReplace}
          onShowReplaceChange={setShowReplace}
          focusRequest={findFocusRequest}
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
