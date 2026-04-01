import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileEntry } from "../types";
import { entryDisplayName } from "../utils/displayName";
import ErrorMessage from "./ErrorMessage";
import {
  detectUnsupportedConstructs,
  formatLinkedInUnicode,
} from "./linkedinFormatting";
import PdfQualityIndicator from "./PdfQualityIndicator";
import { formatPreviewMarkdown } from "./previewFormatting";

interface PreviewPanelProps {
  entry: FileEntry | null;
  onMarkdownChange?: (markdown: string) => void;
  onStartWriting?: () => void;
}

export default function PreviewPanel({
  entry,
  onMarkdownChange,
  onStartWriting,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview" | "linkedin">("preview");

  useEffect(() => {
    setMode(entry?.isScratch ? "edit" : "preview");
  }, [entry?.id, entry?.isScratch]);

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
          {linkedinPreview}
        </pre>
      )
    ) : (
      <div className="markdown-surface">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMarkdown}</ReactMarkdown>
      </div>
    );

  return (
    <div className="preview-body">
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
          <button
            type="button"
            className={`preview-toggle-button${mode === "linkedin" ? " is-active" : ""}`}
            onClick={() => setMode("linkedin")}
            aria-pressed={mode === "linkedin"}
          >
            LinkedIn
          </button>
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
