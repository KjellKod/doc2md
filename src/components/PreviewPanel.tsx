import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileEntry } from "../types";
import { displayName } from "../utils/displayName";
import ErrorMessage from "./ErrorMessage";

interface PreviewPanelProps {
  entry: FileEntry | null;
  onMarkdownChange?: (markdown: string) => void;
}

export default function PreviewPanel({ entry, onMarkdownChange }: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");

  useEffect(() => {
    setMode("preview");
  }, [entry?.id]);

  if (!entry) {
    return (
      <div className="preview-empty-state">
        <p className="empty-state-title">Drop files to convert.</p>
        <p className="empty-state-copy">
          Converted Markdown will render here once a file is ready for review.
        </p>
      </div>
    );
  }

  if (entry.status === "pending" || entry.status === "converting") {
    return (
      <div className="preview-empty-state preview-loading-state" role="status">
        <span className="loading-orb" aria-hidden="true" />
        <p className="empty-state-title">Converting locally.</p>
        <p className="empty-state-copy">
          Preparing a Markdown preview for {displayName(entry.name)}.
        </p>
      </div>
    );
  }

  if (entry.status === "error") {
    return <ErrorMessage message={entry.warnings[0] ?? "Conversion failed."} />;
  }

  if (entry.markdown.length === 0) {
    return (
      <div className="preview-empty-state">
        <p className="empty-state-title">No Markdown output.</p>
        <p className="empty-state-copy">
          This file finished processing, but there is nothing useful to render.
        </p>
      </div>
    );
  }

  const effectiveMarkdown = entry.editedMarkdown ?? entry.markdown;
  const showToggle =
    (entry.status === "success" || entry.status === "warning") &&
    entry.markdown.length > 0;

  return (
    <div className="preview-body">
      {showToggle ? (
        <div className="preview-toggle" role="group" aria-label="Edit or preview mode">
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
        </div>
      ) : null}

      {entry.warnings.length > 0 ? (
        <div className="warning-message" role="status">
          {entry.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {mode === "edit" ? (
        <textarea
          className="markdown-edit-area"
          value={effectiveMarkdown}
          onChange={(event) => onMarkdownChange?.(event.target.value)}
          aria-label="Edit markdown"
        />
      ) : (
        <div className="markdown-surface">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{effectiveMarkdown}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
