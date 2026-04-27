import type { DesktopSaveState } from "../desktop/saveState";

const SAVE_STATE_LABELS: Record<DesktopSaveState, string> = {
  saved: "Saved",
  edited: "Edited",
  saving: "Saving",
  conflict: "Conflict",
  error: "Error",
  "permission-needed": "Permission needed",
};

interface SaveStatePillProps {
  state: DesktopSaveState;
}

export default function SaveStatePill({ state }: SaveStatePillProps) {
  return (
    <span
      className={`save-state-pill save-state-pill--${state}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {SAVE_STATE_LABELS[state]}
    </span>
  );
}
