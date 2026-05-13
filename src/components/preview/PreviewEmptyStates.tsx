import type { FileEntry } from "../../types";
import { entryDisplayName } from "../../utils/displayName";
import ErrorMessage from "../ErrorMessage";
import PdfQualityIndicator from "../PdfQualityIndicator";

interface PreviewEmptyStatesProps {
  entry: FileEntry | null;
  canEditFromEmptyState: boolean;
  onStartWriting?: () => void;
}

export default function PreviewEmptyStates({
  entry,
  canEditFromEmptyState,
  onStartWriting,
}: PreviewEmptyStatesProps) {
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

  return null;
}
