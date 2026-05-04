import { useEffect, useRef } from "react";
import type { FileEntry } from "../types";
import type { SaveState } from "../types/saveState";
import { isDownloadableEntry } from "../utils/download";
import FileListItem from "./FileListItem";

interface FileListProps {
  entries: FileEntry[];
  checkedIds: Set<string>;
  saveStatuses?: Record<string, SaveState>;
  onCheckedChange: (id: string, checked: boolean) => void;
  onClear: () => void;
  onDownload: () => void;
  onSelect: (id: string) => void;
  onToggleAllChecked: () => void;
}

export default function FileList({
  entries,
  checkedIds,
  saveStatuses = {},
  onCheckedChange,
  onClear,
  onDownload,
  onSelect,
  onToggleAllChecked,
}: FileListProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const checkedCount = entries.filter((entry) => checkedIds.has(entry.id)).length;
  const allChecked = entries.length > 0 && checkedCount === entries.length;
  const someChecked = checkedCount > 0 && checkedCount < entries.length;
  const hasCheckedDownloadable = entries.some(
    (entry) => checkedIds.has(entry.id) && isDownloadableEntry(entry),
  );
  const activeEntry = entries.find((entry) => entry.selected) ?? null;
  const canDownload =
    checkedCount > 0 ? hasCheckedDownloadable : isDownloadableEntry(activeEntry);
  const canClear = checkedCount > 0 || activeEntry !== null;
  const downloadLabel =
    checkedCount > 0 ? "Download selected files" : "Download active file";
  const clearLabel =
    checkedCount > 0 ? "Clear selected files" : "Clear active file";

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

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
        <label className="file-list-select-all">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            aria-label="Select all opened files"
            onChange={onToggleAllChecked}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          disabled={!canDownload}
          aria-label={downloadLabel}
          onClick={onDownload}
        >
          Download
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!canClear}
          aria-label={clearLabel}
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <ol className="file-list">
        {entries.map((entry) => (
          <FileListItem
            key={entry.id}
            entry={entry}
            checked={checkedIds.has(entry.id)}
            saveStatus={saveStatuses[entry.id]}
            onCheckedChange={onCheckedChange}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </>
  );
}
