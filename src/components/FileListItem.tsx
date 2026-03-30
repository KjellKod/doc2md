import type { FileEntry } from "../types";
import { entryDisplayName } from "../utils/displayName";
import FormatBadge from "./FormatBadge";
import StatusIndicator from "./StatusIndicator";

interface FileListItemProps {
  entry: FileEntry;
  onSelect: (id: string) => void;
}

export default function FileListItem({ entry, onSelect }: FileListItemProps) {
  const hasScratchContent =
    entry.isScratch &&
    (entry.editedMarkdown ?? entry.markdown).trim().length > 0;
  const notice =
    entry.warnings[0] ??
    (entry.isScratch
      ? hasScratchContent
        ? "Draft is ready to preview and download."
        : "Start writing to enable download."
      : entry.status === "success"
        ? "Markdown is ready to review."
        : "");

  return (
    <li>
      <button
        type="button"
        className={`file-list-item${entry.selected ? " is-selected" : ""}`}
        onClick={() => onSelect(entry.id)}
      >
        <div className="file-list-item-top">
          <div className="file-list-item-name-group">
            <span className="file-list-item-name">
              {entryDisplayName(entry)}
            </span>
            <FormatBadge format={entry.format} />
          </div>
          <StatusIndicator
            status={entry.status}
            label={entry.isScratch ? "Draft" : undefined}
          />
        </div>
        <p className="file-list-item-copy">{notice}</p>
      </button>
    </li>
  );
}
