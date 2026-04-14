import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileEntry } from "../types";
import { entryDisplayName } from "../utils/displayName";
import ErrorMessage from "./ErrorMessage";
import {
  BLOCK_ART_END_MARKER,
  BLOCK_ART_START_MARKER,
  detectUnsupportedConstructs,
  formatLinkedInUnicode,
} from "./linkedinFormatting";
import PdfQualityIndicator from "./PdfQualityIndicator";
import { formatPreviewMarkdown } from "./previewFormatting";

type LinkedInPreviewTone =
  | "bold"
  | "italic"
  | "bold-italic"
  | "underline"
  | "strike"
  | "block-art";

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
  let inBlockArt = false;

  for (const cluster of clusters) {
    if (cluster === BLOCK_ART_START_MARKER) {
      inBlockArt = true;
      continue;
    }

    if (cluster === BLOCK_ART_END_MARKER) {
      inBlockArt = false;
      continue;
    }

    const tone: LinkedInPreviewTone | null = inBlockArt
      ? "block-art"
      : toneForLinkedInCluster(cluster);
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
  onStartWriting,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview" | "linkedin">("preview");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(entry?.isScratch ? "edit" : "preview");
  }, [entry?.id, entry?.isScratch]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

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
          ?.replaceAll(BLOCK_ART_START_MARKER, "")
          .replaceAll(BLOCK_ART_END_MARKER, "")
      : effectiveMarkdown;
  const showCopyButton = showToggle && typeof copyText === "string";

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
      {showToggle || showCopyButton ? (
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
