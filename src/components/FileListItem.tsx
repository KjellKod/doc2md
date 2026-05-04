import type { FileEntry } from "../types";
import type { SaveState } from "../types/saveState";
import { entryDisplayName } from "../utils/displayName";
import FormatBadge from "./FormatBadge";
import StatusIndicator from "./StatusIndicator";

interface FileListItemProps {
  entry: FileEntry;
  checked: boolean;
  saveStatus?: SaveState;
  onCheckedChange: (id: string, checked: boolean) => void;
  onSelect: (id: string) => void;
}

const SAVE_STATUS_LABELS: Record<SaveState, string> = {
  saved: "Saved",
  edited: "Edited",
  saving: "Saving",
  conflict: "Conflict",
  error: "Error",
  "permission-needed": "Permission",
};

export default function FileListItem({
  entry,
  checked,
  saveStatus,
  onCheckedChange,
  onSelect,
}: FileListItemProps) {
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
      <div className="file-list-item-row">
        <label className="file-list-checkbox">
          <input
            type="checkbox"
            checked={checked}
            aria-label={`Select ${entryDisplayName(entry)}`}
            onChange={(event) =>
              onCheckedChange(entry.id, event.currentTarget.checked)
            }
          />
        </label>
        <button
          type="button"
          className={`file-list-item${entry.selected ? " is-selected" : ""}`}
          aria-label={`Open ${entryDisplayName(entry)}`}
          onClick={() => onSelect(entry.id)}
        >
          <div className="file-list-item-top">
            <div className="file-list-item-name-group">
              <span className="file-list-item-name">
                {entryDisplayName(entry)}
              </span>
              <FormatBadge format={entry.format} />
            </div>
            <div className="file-list-item-statuses">
              {saveStatus ? (
                <span
                  className={`file-list-save-status file-list-save-status--${saveStatus}`}
                >
                  {SAVE_STATUS_LABELS[saveStatus]}
                </span>
              ) : null}
              <StatusIndicator
                status={entry.status}
                label={entry.isScratch ? "Draft" : undefined}
              />
            </div>
          </div>
          <p className="file-list-item-copy">{notice}</p>
        </button>
      </div>
    </li>
  );
}
