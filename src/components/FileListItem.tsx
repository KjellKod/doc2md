import { useId } from "react";
import { Save } from "lucide-react";
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

const SAVE_STATUS_DESCRIPTIONS: Record<SaveState, string> = {
  saved: "Saved to disk.",
  edited: "Edited. Save to update the file.",
  saving: "Saving changes.",
  conflict: "File changed on disk. Review before saving.",
  error: "Save failed.",
  "permission-needed": "Permission needed to save.",
};

function statusDescription(entry: FileEntry, hasScratchContent: boolean) {
  if (entry.isScratch && entry.status === "success") {
    return hasScratchContent
      ? "Draft is ready to preview and download."
      : "Start writing to enable download.";
  }

  if (entry.status === "warning") {
    return entry.warnings[0] ?? "Converted with warnings. Review before using.";
  }

  if (entry.status === "error") {
    return "Unable to convert this file.";
  }

  if (entry.status === "converting") {
    return "Converting to Markdown.";
  }

  if (entry.status === "pending") {
    return "Waiting to convert.";
  }

  return "Markdown is ready to review.";
}

export default function FileListItem({
  entry,
  checked,
  saveStatus,
  onCheckedChange,
  onSelect,
}: FileListItemProps) {
  const fullNameTooltipId = useId();
  const saveStatusTooltipId = useId();
  const statusTooltipId = useId();
  const displayName = entryDisplayName(entry);
  const hasScratchContent = Boolean(
    entry.isScratch &&
      (entry.editedMarkdown ?? entry.markdown).trim().length > 0,
  );
  const saveStatusDescription = saveStatus
    ? SAVE_STATUS_DESCRIPTIONS[saveStatus]
    : undefined;
  const isSavedCompact = saveStatus === "saved";
  const isReadyCompact = entry.status === "success" && !entry.isScratch;
  const describedBy = [
    fullNameTooltipId,
    saveStatus ? saveStatusTooltipId : undefined,
    statusTooltipId,
  ]
    .filter((id): id is string => Boolean(id))
    .join(" ");

  return (
    <li>
      <div className="file-list-item-row">
        <label className="file-list-checkbox">
          <input
            type="checkbox"
            checked={checked}
            aria-label={`Select ${displayName}`}
            onChange={(event) =>
              onCheckedChange(entry.id, event.currentTarget.checked)
            }
          />
        </label>
        <button
          type="button"
          className={`file-list-item${entry.selected ? " is-selected" : ""}`}
          aria-label={`Open ${displayName}`}
          aria-describedby={describedBy}
          onClick={() => onSelect(entry.id)}
        >
          <div className="file-list-item-top">
            <div className="file-list-item-name-group">
              <span className="file-list-item-name">
                {displayName}
              </span>
              <span
                id={fullNameTooltipId}
                role="tooltip"
                className="file-list-item-name-tooltip"
              >
                {displayName}
              </span>
            </div>
            <div className="file-list-item-statuses">
              {saveStatus ? (
                <span
                  className={`file-list-save-status file-list-save-status--${saveStatus}${
                    isSavedCompact ? " file-list-save-status--compact" : ""
                  }`}
                  aria-label={saveStatusDescription}
                  aria-describedby={saveStatusTooltipId}
                >
                  {isSavedCompact ? (
                    <>
                      <Save
                        className="file-list-save-status-icon"
                        aria-hidden="true"
                      />
                      <span className="visually-hidden">
                        {SAVE_STATUS_LABELS[saveStatus]}
                      </span>
                    </>
                  ) : (
                    SAVE_STATUS_LABELS[saveStatus]
                  )}
                  <span
                    id={saveStatusTooltipId}
                    role="tooltip"
                    className="file-list-status-tooltip"
                  >
                    {saveStatusDescription}
                  </span>
                </span>
              ) : null}
              <StatusIndicator
                status={entry.status}
                label={
                  entry.isScratch && entry.status === "success"
                    ? "Draft"
                    : undefined
                }
                compact={isReadyCompact}
                description={statusDescription(entry, hasScratchContent)}
                descriptionId={statusTooltipId}
              />
            </div>
            <FormatBadge format={entry.format} />
          </div>
        </button>
      </div>
    </li>
  );
}
