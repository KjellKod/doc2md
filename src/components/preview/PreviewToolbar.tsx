import {
  FileCode,
  FilePlus,
  FileText,
  Keyboard,
  Search,
  WandSparkles,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
  onDownloadMarkdown?: () => void | Promise<void>;
  downloadMarkdownDisabled?: boolean;
  downloadMarkdownBusy?: boolean;
  saveBusy: boolean;
  saveDisabled: boolean;
  saveKeyShortcuts?: string;
  saveState: SaveState;
  lastSavedAt: number | null;
  onExportHtml?: () => void | Promise<void>;
  exportHtmlBusy?: boolean;
  exportHtmlDisabled?: boolean;
  onNewDocument?: () => void;
  showAdjustFormatting?: boolean;
  adjustFormattingDisabled?: boolean;
  onAdjustFormatting?: () => void;
  onModeChange: (mode: PreviewModeName) => void;
  onOpenFind: () => void;
  onCopy: () => void;
}

interface ShortcutRow {
  label: string;
  keys: string;
}

function shortcutRows(saveKeyShortcuts?: string): ShortcutRow[] {
  const mod = "Cmd/Ctrl";
  const shift = "Shift";
  const rows: ShortcutRow[] = [
    { label: "Find", keys: `${mod}+F` },
    { label: "Bold", keys: `${mod}+B` },
    { label: "Italic", keys: `${mod}+I` },
    { label: "Link", keys: `${mod}+K` },
    { label: "Ordered list", keys: `${mod}+${shift}+7` },
    { label: "Bulleted list", keys: `${mod}+${shift}+8` },
    { label: "Task list", keys: `${mod}+${shift}+9` },
    { label: "Close find or menu", keys: "Escape" },
  ];

  if (saveKeyShortcuts) {
    rows.unshift({ label: "Save document", keys: "Cmd+S" });
  }

  return rows;
}

export default function PreviewToolbar({
  toolbarRef,
  mode,
  copyState,
  showToggle,
  showCopyButton,
  onSave,
  onDownloadMarkdown,
  downloadMarkdownDisabled = false,
  downloadMarkdownBusy = false,
  saveBusy,
  saveDisabled,
  saveKeyShortcuts,
  saveState,
  lastSavedAt,
  onExportHtml,
  exportHtmlBusy = false,
  exportHtmlDisabled = false,
  onNewDocument,
  showAdjustFormatting = false,
  adjustFormattingDisabled = false,
  onAdjustFormatting,
  onModeChange,
  onOpenFind,
  onCopy,
}: PreviewToolbarProps) {
  const shortcutsPanelId = useId();
  const downloadMarkdownTooltipId = useId();
  const downloadHtmlTooltipId = useId();
  const adjustFormattingTooltipId = useId();
  const shortcutsButtonRef = useRef<HTMLButtonElement | null>(null);
  const shortcutsRef = useRef<HTMLDivElement | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const rows = shortcutRows(saveKeyShortcuts);

  useEffect(() => {
    if (!isShortcutsOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        !shortcutsRef.current?.contains(target) &&
        !shortcutsButtonRef.current?.contains(target)
      ) {
        setIsShortcutsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsShortcutsOpen(false);
        window.setTimeout(() => shortcutsButtonRef.current?.focus(), 0);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isShortcutsOpen]);

  if (!showToggle && !showCopyButton && !onSave && !onExportHtml) {
    return null;
  }

  function closeShortcuts() {
    setIsShortcutsOpen(false);
    window.setTimeout(() => shortcutsButtonRef.current?.focus(), 0);
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
            View
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
        {showAdjustFormatting ? (
          <span className="instant-tooltip-anchor">
            <button
              type="button"
              className="ghost-button format-download-button"
              onClick={onAdjustFormatting}
              disabled={adjustFormattingDisabled}
              aria-disabled={adjustFormattingDisabled}
              aria-label="Adjust formatting"
              aria-describedby={adjustFormattingTooltipId}
            >
              <WandSparkles
                className="format-download-icon"
                aria-hidden="true"
              />
            </button>
            <span
              id={adjustFormattingTooltipId}
              role="tooltip"
              className="instant-tooltip"
            >
              Adjust formatting
            </span>
          </span>
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
        {onDownloadMarkdown || onExportHtml ? (
          <div
            className="format-download-actions"
            role="group"
            aria-label="Download formats"
          >
            {onDownloadMarkdown ? (
              <span className="instant-tooltip-anchor">
                <button
                  type="button"
                  className="ghost-button format-download-button"
                  onClick={() => void onDownloadMarkdown()}
                  disabled={downloadMarkdownDisabled || downloadMarkdownBusy}
                  aria-disabled={downloadMarkdownDisabled || downloadMarkdownBusy}
                  aria-busy={downloadMarkdownBusy}
                  aria-label="Download Markdown"
                  aria-describedby={downloadMarkdownTooltipId}
                >
                  <FileText
                    className="format-download-icon"
                    aria-hidden="true"
                  />
                  <span className="format-download-badge" aria-hidden="true">
                    MD
                  </span>
                </button>
                <span
                  id={downloadMarkdownTooltipId}
                  role="tooltip"
                  className="instant-tooltip"
                >
                  Download Markdown
                </span>
              </span>
            ) : null}
            {onExportHtml ? (
              <span className="instant-tooltip-anchor">
                <button
                  type="button"
                  className="ghost-button format-download-button"
                  onClick={() => void onExportHtml()}
                  disabled={exportHtmlDisabled || exportHtmlBusy}
                  aria-disabled={exportHtmlDisabled || exportHtmlBusy}
                  aria-busy={exportHtmlBusy}
                  aria-label="Download HTML"
                  aria-describedby={downloadHtmlTooltipId}
                >
                  <FileCode
                    className="format-download-icon"
                    aria-hidden="true"
                  />
                  <span className="format-download-badge" aria-hidden="true">
                    HTML
                  </span>
                </button>
                <span
                  id={downloadHtmlTooltipId}
                  role="tooltip"
                  className="instant-tooltip"
                >
                  Download HTML
                </span>
              </span>
            ) : null}
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
        {showToggle ? (
          <div className="shortcut-reference-wrap">
            <button
              ref={shortcutsButtonRef}
              type="button"
              className="shortcut-reference-button"
              onClick={() => setIsShortcutsOpen((isOpen) => !isOpen)}
              aria-label="Keyboard shortcuts"
              aria-expanded={isShortcutsOpen}
              aria-controls={shortcutsPanelId}
            >
              <Keyboard className="shortcut-reference-icon" aria-hidden="true" />
            </button>
            {isShortcutsOpen ? (
              <div
                ref={shortcutsRef}
                id={shortcutsPanelId}
                className="shortcut-reference-popover"
                role="dialog"
                aria-label="Keyboard shortcuts"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeShortcuts();
                  }
                }}
              >
                <dl className="shortcut-reference-list">
                  {rows.map((row) => (
                    <div className="shortcut-reference-row" key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.keys}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
