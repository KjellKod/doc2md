import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileEntry } from "../types";
import ErrorMessage from "./ErrorMessage";

interface PreviewPanelProps {
  entry: FileEntry | null;
}

export default function PreviewPanel({ entry }: PreviewPanelProps) {
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
          Preparing a Markdown preview for {entry.name}.
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

  return (
    <div className="preview-body">
      {entry.warnings.length > 0 ? (
        <div className="warning-message" role="status">
          {entry.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="markdown-surface">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
