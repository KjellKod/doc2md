import type { FileEntry } from "../types";
import FileListItem from "./FileListItem";

interface FileListProps {
  entries: FileEntry[];
  onSelect: (id: string) => void;
}

export default function FileList({ entries, onSelect }: FileListProps) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">Nothing uploaded yet.</p>
        <p className="empty-state-copy">
          Drop in a file or browse to start a local conversion session.
        </p>
      </div>
    );
  }

  return (
    <ol className="file-list">
      {entries.map((entry) => (
        <FileListItem key={entry.id} entry={entry} onSelect={onSelect} />
      ))}
    </ol>
  );
}
