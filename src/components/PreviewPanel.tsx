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
        <p className="empty-state-title">No preview yet.</p>
        <p className="empty-state-copy">
          Select a converted file to inspect the rendered Markdown.
        </p>
      </div>
    );
  }

  if (entry.status === "pending" || entry.status === "converting") {
    return (
      <div className="preview-empty-state">
        <p className="empty-state-title">Preparing preview.</p>
        <p className="empty-state-copy">
          The file is being converted locally in your browser.
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
        <p className="empty-state-title">This file is empty.</p>
        <p className="empty-state-copy">
          The conversion succeeded, but there is nothing to render.
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
