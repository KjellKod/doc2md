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
  /** Wall-clock time of the most recent successful save. When provided and
   *  `state === "saved"`, the pill renders `"Saved · <relative time>"`. */
  lastSavedAt?: number | null;
}

export default function SaveStatePill({
  state,
  lastSavedAt = null,
}: SaveStatePillProps) {
  const relative = useRelativeTime(state === "saved" ? lastSavedAt : null);
  const label =
    state === "saved" && relative
      ? `Saved · ${relative}`
      : SAVE_STATE_LABELS[state];
  return (
    <span
      className={`save-state-pill save-state-pill--${state}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </span>
  );
}
