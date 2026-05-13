import { FilePlus, Search } from "lucide-react";
import type { SaveState } from "../../types/saveState";
import SaveButton from "../SaveButton";
import SaveStatePill from "../SaveStatePill";

type PreviewModeName = "edit" | "preview" | "linkedin";

interface PreviewToolbarProps {
  toolbarRef: { current: HTMLDivElement | null };
  mode: PreviewModeName;
  copyState: "idle" | "copied";
  showToggle: boolean;
  showCopyButton: boolean;
  onSave?: () => void | Promise<void>;
  saveBusy: boolean;
  saveDisabled: boolean;
  saveKeyShortcuts?: string;
  saveState: SaveState;
  lastSavedAt: number | null;
  onNewDocument?: () => void;
  onModeChange: (mode: PreviewModeName) => void;
  onOpenFind: () => void;
  onCopy: () => void;
}

export default function PreviewToolbar({
  toolbarRef,
  mode,
  copyState,
  showToggle,
  showCopyButton,
  onSave,
  saveBusy,
  saveDisabled,
  saveKeyShortcuts,
  saveState,
  lastSavedAt,
  onNewDocument,
  onModeChange,
  onOpenFind,
  onCopy,
}: PreviewToolbarProps) {
  if (!showToggle && !showCopyButton && !onSave) {
    return null;
  }

  return (
    <div
      ref={(element) => {
        toolbarRef.current = element;
      }}
      className="preview-toolbar"
    >
      {showToggle ? (
        <div
          className="preview-toggle"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            className={`preview-toggle-button${mode === "edit" ? " is-active" : ""}`}
            onClick={() => onModeChange("edit")}
            aria-pressed={mode === "edit"}
          >
            Edit
          </button>
          <button
            type="button"
            className={`preview-toggle-button${mode === "preview" ? " is-active" : ""}`}
            onClick={() => onModeChange("preview")}
            aria-pressed={mode === "preview"}
          >
            Preview
          </button>
          <div className="preview-toggle-with-tooltip">
            <button
              type="button"
              className={`preview-toggle-button${mode === "linkedin" ? " is-active" : ""}`}
              onClick={() => onModeChange("linkedin")}
              aria-pressed={mode === "linkedin"}
              aria-describedby="linkedin-toggle-tooltip"
            >
              LinkedIn
            </button>
            <span
              id="linkedin-toggle-tooltip"
              role="tooltip"
              className="preview-toggle-tooltip"
            >
              Unicode formatting for easy LinkedIn posting
            </span>
          </div>
        </div>
      ) : (
        <div />
      )}
      <div className="preview-toolbar-actions">
        {onNewDocument ? (
          <button
            type="button"
            className="ghost-button find-entry-button"
            onClick={onNewDocument}
            aria-label="New document"
          >
            <FilePlus className="find-entry-icon" aria-hidden="true" />
            <span className="find-entry-label">New</span>
          </button>
        ) : null}
        {showToggle ? (
          <button
            type="button"
            className="find-entry-button"
            onClick={onOpenFind}
            aria-label="Find and replace"
            aria-keyshortcuts="Meta+F Control+F"
          >
            <Search className="find-entry-icon" aria-hidden="true" />
            <span className="find-entry-label">Find</span>
          </button>
        ) : null}
        {onSave ? (
          <div className="save-control-group">
            <SaveButton
              onSave={onSave}
              disabled={saveDisabled}
              busy={saveBusy}
              ariaKeyshortcuts={saveKeyShortcuts}
            />
            <SaveStatePill state={saveState} lastSavedAt={lastSavedAt} />
          </div>
        ) : null}
        {showCopyButton ? (
          <div className="preview-actions">
            <button
              type="button"
              className="preview-copy-button"
              onClick={onCopy}
              aria-label={
                mode === "preview"
                  ? "Copy formatted text"
                  : mode === "linkedin"
                    ? "Copy LinkedIn text"
                    : "Copy markdown document"
              }
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="preview-copy-icon"
              >
                <rect x="9" y="7" width="10" height="12" rx="2" />
                <rect x="5" y="3" width="10" height="12" rx="2" />
              </svg>
            </button>
            <span
              className={`preview-copy-tooltip${copyState === "copied" ? " is-visible" : ""}`}
              aria-live="polite"
            >
              {copyState === "copied" ? "Copied" : "Copy"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
