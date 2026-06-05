import type { FileEntry } from "../../types";
import { entryDisplayName } from "../../utils/displayName";
import ErrorMessage from "../ErrorMessage";
import QualityIndicator from "../QualityIndicator";

interface PreviewEmptyStatesProps {
  entry: FileEntry | null;
  canEditFromEmptyState: boolean;
  onStartWriting?: () => void;
}

const CONVERSION_FAILED_FALLBACK_MESSAGE =
  "Conversion failed. Try another file or start writing and paste the text.";

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
        <p className="empty-state-title">Nothing to preview yet.</p>
        <p className="empty-state-copy">
          Start writing or convert a file; the Markdown result will appear here.
          Click anywhere here to start writing.
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
          Preparing Markdown for {entryDisplayName(entry)}. The preview will
          appear here when it is ready.
        </p>
      </div>
    );
  }

  if (entry.status === "error") {
    if (entry.quality) {
      return (
        <div className="preview-body">
          <QualityIndicator quality={entry.quality} format={entry.format} />
          <ErrorMessage
            message={
              entry.warnings[0] ?? CONVERSION_FAILED_FALLBACK_MESSAGE
            }
          />
        </div>
      );
    }

    return (
      <ErrorMessage
        message={entry.warnings[0] ?? CONVERSION_FAILED_FALLBACK_MESSAGE}
      />
    );
  }

  if (entry.markdown.length === 0 && !canEditFromEmptyState) {
    return (
      <div className="preview-empty-state">
        <p className="empty-state-title">No Markdown was produced.</p>
        <p className="empty-state-copy">
          Try another file, or start a draft and paste the content manually.
        </p>
      </div>
    );
  }

  return null;
}
