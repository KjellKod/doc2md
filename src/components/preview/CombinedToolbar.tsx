import { Copy, Download, Save, Search, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { PreviewToolbarProps } from "./PreviewToolbar";
import SaveStatePill from "../SaveStatePill";

export default function CombinedToolbar(props: PreviewToolbarProps) {
  const { toolbarRef } = props;
  const documentVisible = props.documentControlsVisible !== false;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const gearRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLElement>("select,input,button,a[href]")
      ?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !panelRef.current?.contains(event.target as Node) &&
        !gearRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      gearRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const copyLabel =
    props.mode === "preview"
      ? "Copy formatted text"
      : props.mode === "linkedin"
        ? "Copy LinkedIn text"
        : "Copy markdown document";
  const outputLabel =
    props.outputMode === "download" ? "Download Markdown" : "Save document";
  function icon(
    label: string,
    contents: ReactNode,
    action: () => void,
    options: {
      disabled?: boolean;
      busy?: boolean;
      primary?: boolean;
      keyShortcuts?: string;
      tooltip?: string;
    } = {},
  ) {
    const tooltipId = `${panelId}-${label.replace(/\s+/g, "-")}`;
    return (
      <span
        className="instant-tooltip-anchor"
        tabIndex={options.disabled ? 0 : undefined}
        role={options.disabled ? "group" : undefined}
        aria-label={options.disabled ? `${label} unavailable` : undefined}
        aria-describedby={options.disabled ? tooltipId : undefined}
      >
        <button
          type="button"
          className={`combined-icon-button combined-toolbar-icon${options.primary ? " combined-primary-action" : ""}`}
          aria-label={label}
          aria-describedby={tooltipId}
          disabled={options.disabled}
          aria-busy={options.busy}
          aria-keyshortcuts={options.keyShortcuts}
          onClick={action}
        >
          {contents}
        </button>
        <span id={tooltipId} role="tooltip" className="instant-tooltip">
          {options.tooltip ?? label}
        </span>
      </span>
    );
  }
  function command(label: string, action: () => void, disabled = false) {
    return (
      <button
        type="button"
        className="combined-settings-action"
        disabled={disabled}
        onClick={() => {
          setOpen(false);
          gearRef.current?.focus();
          action();
        }}
      >
        {label}
      </button>
    );
  }
  function dismissSettingsCommand(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    const command = target instanceof Element ? target.closest("button,a[href]") : null;
    if (
      !command ||
      (command instanceof HTMLButtonElement && command.disabled) ||
      command.hasAttribute("data-keep-settings-open")
    )
      return;
    setOpen(false);
    gearRef.current?.focus();
  }
  return (
    <div
      className="combined-toolbar"
      ref={(element) => {
        toolbarRef.current = element;
      }}
    >
      <div className="combined-toolbar-start">{props.toolbarStart}</div>
      <div className="combined-toolbar-controls">
        {documentVisible && props.showToggle && (
          <div
            className="preview-toggle combined-toolbar-modes"
            role="group"
            aria-label="View mode"
          >
            {(
              [
                ["edit", "Edit"],
                ["preview", "View"],
                ["linkedin", "LinkedIn"],
              ] as const
            ).map(([mode, label]) => (
              <button
                type="button"
                key={mode}
                className={`preview-toggle-button${props.mode === mode ? " is-active" : ""}`}
                aria-pressed={props.mode === mode}
                onClick={() => props.onModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {documentVisible && props.showToggle && (
          <span className="combined-find-action">
            {icon(
              "Find and replace",
              <Search aria-hidden="true" />,
              props.onOpenFind,
              { keyShortcuts: "Meta+F Control+F" },
            )}
          </span>
        )}
        {documentVisible && props.showCopyButton && (
          <>
            <span className="combined-copy-action">
              {icon(copyLabel, <Copy aria-hidden="true" />, props.onCopy)}
            </span>
            <span className="visually-hidden" aria-live="polite">
              {props.copyState === "copied" ? "Copied" : ""}
            </span>
          </>
        )}
        {documentVisible && props.onSave && (
          <div className="save-control-group">
            {icon(
              outputLabel,
              props.outputMode === "download" ? (
                <Download aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              ),
              () => void props.onSave?.(),
              {
                disabled: props.saveDisabled || props.saveBusy,
                busy: props.saveBusy,
                primary: true,
                tooltip:
                  props.outputMode === "download" &&
                  (props.saveDisabled || props.saveBusy)
                    ? props.saveBusy
                      ? "Preparing download"
                      : props.showToggle
                        ? "Add text to download"
                        : "Open a document or wait for conversion to finish"
                    : outputLabel,
                keyShortcuts: props.saveKeyShortcuts,
              },
            )}
            {!(
              props.outputMode === "download" &&
              (props.saveState === "edited" ||
                (props.saveState === "saved" && props.lastSavedAt == null))
            ) && (
              <SaveStatePill
                state={props.saveState}
                lastSavedAt={props.lastSavedAt}
                outputMode={props.outputMode}
                compact
              />
            )}
          </div>
        )}
        <div className="combined-settings-wrap">
          <span className="instant-tooltip-anchor">
            <button
              ref={gearRef}
              type="button"
              className="combined-icon-button combined-toolbar-icon"
              aria-label="Settings"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((value) => !value)}
            >
              <Settings aria-hidden="true" />
            </button>
            <span role="tooltip" className="instant-tooltip">
              Settings
            </span>
          </span>
          {open && (
            <div
              ref={panelRef}
              id={panelId}
              className="combined-settings"
              role="dialog"
              aria-label="Settings"
            >
              <div
                className="combined-settings-content"
                onClick={dismissSettingsCommand}
              >
                {props.settingsContent}
              </div>
              {props.onToggleLineNumbers && (
                <label className="line-numbers-checkbox">
                  <input
                    type="checkbox"
                    checked={props.showLineNumbers}
                    onChange={props.onToggleLineNumbers}
                  />
                  <span>Line numbers</span>
                </label>
              )}
              {documentVisible && (props.onDownloadMarkdown ||
                props.onExportHtml ||
                props.showAdjustFormatting) && (
                <div className="combined-settings-actions">
                  {props.onDownloadMarkdown &&
                    props.outputMode !== "download" &&
                    command(
                      "Download Markdown",
                      () => void props.onDownloadMarkdown?.(),
                      props.downloadMarkdownDisabled ||
                        props.downloadMarkdownBusy,
                    )}
                  {props.onExportHtml &&
                    command(
                      "Download HTML",
                      () => void props.onExportHtml?.(),
                      props.exportHtmlDisabled || props.exportHtmlBusy,
                    )}
                  {props.showAdjustFormatting &&
                    command(
                      "Adjust formatting",
                      () => props.onAdjustFormatting?.(),
                      props.adjustFormattingDisabled,
                    )}
                </div>
              )}
              <div className="combined-settings-narrow-action">
                {documentVisible && props.showToggle &&
                  command("Find and replace", props.onOpenFind)}
                {documentVisible && props.showCopyButton && command(copyLabel, props.onCopy)}
              </div>
              {documentVisible && props.showToggle && (
                <details className="combined-shortcuts">
                  <summary>Keyboard shortcuts</summary>
                  <dl>
                    <dt>Find</dt>
                    <dd>Cmd/Ctrl+F</dd>
                    {props.saveKeyShortcuts && <>
                      <dt>{outputLabel}</dt>
                      <dd>{props.saveKeyShortcuts.replace(/Meta/g, "Cmd").replace(/Control/g, "Ctrl")}</dd>
                    </>}
                    <dt>Bold / Italic / Link</dt>
                    <dd>Cmd/Ctrl+B / I / K</dd>
                    <dt>Ordered / Bulleted / Task list</dt>
                    <dd>Cmd/Ctrl+Shift+7 / 8 / 9</dd>
                    <dt>Close find or menu</dt>
                    <dd>Escape</dd>
                  </dl>
                </details>
              )}
              <div
                className="combined-settings-footer"
                onClick={dismissSettingsCommand}
              >
                {props.settingsActions}
              </div>
              <button
                type="button"
                className="combined-settings-action"
                onClick={() => {
                  setOpen(false);
                  gearRef.current?.focus();
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
