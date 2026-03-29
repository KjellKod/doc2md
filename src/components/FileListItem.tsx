import type { FileEntry } from "../types";
import { displayName } from "../utils/displayName";
import FormatBadge from "./FormatBadge";
import StatusIndicator from "./StatusIndicator";

interface FileListItemProps {
  entry: FileEntry;
  onSelect: (id: string) => void;
}

export default function FileListItem({ entry, onSelect }: FileListItemProps) {
  const notice =
    entry.warnings[0] ??
    (entry.status === "success" ? "Markdown is ready to review." : "");

  return (
    <li>
      <button
        type="button"
        className={`file-list-item${entry.selected ? " is-selected" : ""}`}
        onClick={() => onSelect(entry.id)}
      >
        <div className="file-list-item-top">
          <div className="file-list-item-name-group">
            <span className="file-list-item-name">{displayName(entry.name)}</span>
            <FormatBadge format={entry.format} />
          </div>
          <StatusIndicator status={entry.status} />
        </div>
        <p className="file-list-item-copy">{notice}</p>
      </button>
    </li>
  );
}
