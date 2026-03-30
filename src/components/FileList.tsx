import type { FileEntry } from "../types";
import { isDownloadableEntry } from "../utils/download";
import FileListItem from "./FileListItem";

interface FileListProps {
  entries: FileEntry[];
  onClearAll: () => void;
  onDownloadAll: () => void;
  onSelect: (id: string) => void;
}

export default function FileList({
  entries,
  onClearAll,
  onDownloadAll,
  onSelect,
}: FileListProps) {
  const readyCount = entries.filter(isDownloadableEntry).length;

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">Drop files or start writing.</p>
        <p className="empty-state-copy">
          Uploaded files convert one by one, and scratch drafts stay beside them
          in the same browser session.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="file-list-toolbar">
        <button
          type="button"
          className="secondary-button"
          disabled={readyCount === 0}
          onClick={onDownloadAll}
        >
          Download All
        </button>
        <button type="button" className="ghost-button" onClick={onClearAll}>
          Clear All
        </button>
      </div>

      <ol className="file-list">
        {entries.map((entry) => (
          <FileListItem key={entry.id} entry={entry} onSelect={onSelect} />
        ))}
      </ol>
    </>
  );
}
