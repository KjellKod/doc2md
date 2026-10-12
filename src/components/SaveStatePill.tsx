import type { SaveState } from "../types/saveState";
import { useRelativeTime } from "../hooks/useRelativeTime";

const SAVE_STATE_LABELS: Record<SaveState, string> = {
  saved: "Saved",
  edited: "Unsaved",
  saving: "Saving",
  conflict: "Conflict",
  error: "Error",
  "permission-needed": "Permission needed",
};

interface SaveStatePillProps {
  state: SaveState;
  outputMode?: "save" | "download";
  compact?: boolean;
  /** Most recent successful save or browser download dispatch. */
  lastSavedAt?: number | null;
}

export default function SaveStatePill({
  state,
  outputMode = "save",
  compact = false,
  lastSavedAt = null,
}: SaveStatePillProps) {
  const showRelativeTime = !(compact && outputMode === "download");
  const relative = useRelativeTime(
    state === "saved" && showRelativeTime ? lastSavedAt : null,
  );
  let label = SAVE_STATE_LABELS[state];
  if (outputMode === "download") {
    if (state === "saved") {
      label = lastSavedAt === null ? "Ready to download" : "Download started";
    } else if (state === "edited") {
      label = "Not downloaded";
    } else if (state === "saving") {
      label = "Preparing download";
    }
  }
  if (state === "saved" && relative && showRelativeTime) {
    label = `${label} · ${relative}`;
  }
  return (
    <span
      className={`save-state-pill save-state-pill--${state}`}
      data-output-mode={outputMode}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </span>
  );
}
