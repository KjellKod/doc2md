import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversionStatus, FileEntry } from "../../types";
import type { SaveState } from "../../types/saveState";
import FindReplaceBar from "../FindReplaceBar";
import QualityIndicator from "../QualityIndicator";
import { useViewportAnchor } from "./useViewportAnchor";
import type { FindMatch } from "../useFindReplace";
import EditMode from "./EditMode";
import LinkedInMode, { getLinkedInPreviewState } from "./LinkedInMode";
import PreviewEmptyStates from "./PreviewEmptyStates";
import PreviewMode from "./PreviewMode";
import PreviewToolbar from "./PreviewToolbar";
import { performPreviewCopy } from "./previewCopy";
import { analyzeLargeMarkdown } from "../../render/largeMarkdown";
import { getLargeJsonPreview } from "./largeJsonPreview";
import { detectJsonFormatTarget } from "./editorJsonFormat";
import { commitTargetedInsert } from "./targetedTextareaEdit";
/**
 * Per-document viewport position remembered across document switches so
 * returning to a large doc lands where you left off instead of jumping to the
 * top. `anchorLine` is the source line at the top of the viewport — the same
 * mode-agnostic currency the edit/preview switch uses — so it restores
 * position in BOTH preview and edit. The optional fields capture the exact
 * edit caret/scroll and are only present when the doc was left in edit mode.
 * Owned/persisted by the adapter; PreviewPanel captures it as the user scrolls
 * and reapplies it on return.
 */
export interface EditorViewState {
  anchorLine?: number;
  selectionStart?: number;
  selectionEnd?: number;
  scrollTop?: number;
}

export interface PreviewPanelProps {
  entry: FileEntry | null;
  getSavedEditorViewState?: (id: string) => EditorViewState | undefined;
  onEditorViewStateChange?: (id: string, state: EditorViewState) => void;
  onMarkdownChange?: (markdown: string) => void;
  onSave?: () => void | Promise<void>;
  onDownloadMarkdown?: () => void | Promise<void>;
  downloadMarkdownDisabled?: boolean;
  downloadMarkdownBusy?: boolean;
  saveBusy?: boolean;
  saveDisabled?: boolean;
  saveKeyShortcuts?: string;
  saveState?: SaveState;
  lastSavedAt?: number | null;
  onExportHtml?: () => void | Promise<void>;
  exportHtmlBusy?: boolean;
  exportHtmlDisabled?: boolean;
  onStartWriting?: () => void;
  onNewDocument?: () => void;
  editorFocusRequest?: { id: number; target: "editor" };
  onLargeMarkdownPaste?: (markdown: string) => void;
}

export default function PreviewPanel({
  entry,
  getSavedEditorViewState,
  onEditorViewStateChange,
  onMarkdownChange,
  onSave,
  onDownloadMarkdown,
  downloadMarkdownDisabled = false,
  downloadMarkdownBusy = false,
  saveBusy = false,
  saveDisabled = false,
  saveKeyShortcuts,
  saveState = "saved",
  lastSavedAt = null,
  onExportHtml,
  exportHtmlBusy = false,
  exportHtmlDisabled = false,
  onStartWriting,
  onNewDocument,
  editorFocusRequest,
  onLargeMarkdownPaste,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview" | "linkedin">("preview");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [justFinishedConverting, setJustFinishedConverting] = useState(false);
  const prevEntryStatusRef = useRef<ConversionStatus | undefined>(undefined);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [activeFindMatch, setActiveFindMatch] = useState<FindMatch | null>(null);
  const [renderedViewText, setRenderedViewText] = useState("");
  const [editorSelection, setEditorSelection] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 0 });
  const [findFocusRequest, setFindFocusRequest] =
    useState<{ id: number; target: "find" | "replace" }>({
      id: 0,
      target: "find",
    });
  const editorFocusRequestId = editorFocusRequest?.id;
  const editorFocusRequestTarget = editorFocusRequest?.target;
  const previewRef = useRef<HTMLDivElement | null>(null);
  const renderedViewRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const findHighlightRef = useRef<HTMLPreElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const pendingAnchorLineRef = useRef<number | null>(null);
  const suppressMatchCenteringForModeSwitchRef = useRef(false);
  // Cross-document edit caret/scroll restore. Seeded (with pendingAnchorLineRef)
  // when the selected entry changes and consumed + cleared once by EditMode on
  // its next mount. Only carries selection/scroll when the doc was left in edit.
  const pendingEditorRestoreRef = useRef<EditorViewState | null>(null);
  const entryId = entry?.id ?? null;

  // Reset-on-entry-change handled synchronously DURING render (React's
  // "adjust state when a prop changes" pattern, guarded by previous-entry
  // refs). Doing the mode reset here rather than in a passive effect means the
  // correct mode child mounts in the very first commit: a passive effect would
  // first mount the PREVIOUS mode for one transient commit, and if that was
  // edit it would consume + clear the cross-document anchor/caret handoff
  // before preview ever mounts (preview then lands at the top). Seeding the
  // pending refs in the same block hands the saved viewport line to whichever
  // mode mounts — exactly how switchMode seeds synchronously before remounting.
  const previousEntryIdRef = useRef<string | null | undefined>(undefined);
  const previousIsScratchRef = useRef<boolean | undefined>(undefined);
  /* eslint-disable react-hooks/refs -- render-phase reset handoff: tracking the
     previous entry and seeding the pending refs during render is intentional
     (see note above); this is the documented "adjust state on prop change"
     pattern, which necessarily reads/writes refs in render. */
  if (
    entryId !== previousEntryIdRef.current ||
    entry?.isScratch !== previousIsScratchRef.current
  ) {
    const idChanged = entryId !== previousEntryIdRef.current;
    previousEntryIdRef.current = entryId;
    previousIsScratchRef.current = entry?.isScratch;
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
    setActiveFindMatch(null);
    setRenderedViewText("");
    suppressMatchCenteringForModeSwitchRef.current = false;
    if (idChanged) {
      prevEntryStatusRef.current = undefined;
      const saved = entryId ? getSavedEditorViewState?.(entryId) : undefined;
      pendingAnchorLineRef.current = saved?.anchorLine ?? null;
      pendingEditorRestoreRef.current =
        saved && saved.selectionStart != null ? saved : null;
    }
  }
  /* eslint-enable react-hooks/refs */

  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  // Keep the overlay visible briefly after conversion completes so React has
  // time to render the content before the overlay disappears.
  useEffect(() => {
    const curr = entry?.status;
    const prev = prevEntryStatusRef.current;
    prevEntryStatusRef.current = curr;

    const wasConverting = prev === "converting" || prev === "pending";
    const isNowReady = curr === "success" || curr === "warning";

    if (wasConverting && isNowReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJustFinishedConverting(true);
      const id = window.setTimeout(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJustFinishedConverting(false);
      }, 500);
      return () => window.clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- prevEntryStatusRef is a ref, not a reactive value
  }, [entry?.status]);

  // Close find when the active source loses find-capability (e.g. the
  // entry transitions to an error status). The render path cannot derive
  // this because closing must clear activeFindMatch too.
  useEffect(() => {
    if (!findCapable && isFindOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close-on-source-loss (see comment above)
      setIsFindOpen(false);
      setActiveFindMatch(null);
    }
  }, [findCapable, isFindOpen]);

  // Collapse replace row when leaving edit mode (preview/linkedin show
  // find-only). Effect form because the change is derived from mode.
  useEffect(() => {
    if (mode !== "edit" && showReplace) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- collapse-replace-on-mode-leave (see comment above)
      setShowReplace(false);
    }
  }, [mode, showReplace]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  // External focus-request id+target lands as a prop change; sync mode
  // to edit and focus the textarea after commit.
  useEffect(() => {
    if (
      editorFocusRequestId === undefined ||
      editorFocusRequestId === 0 ||
      editorFocusRequestTarget !== "editor"
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-focus-request (see comment above)
    setMode("edit");
    const timeoutId = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [editorFocusRequestId, editorFocusRequestTarget]);

  useEffect(() => {
    function handleFindShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isFindShortcut =
        key === "f" &&
        !event.altKey &&
        !event.shiftKey &&
        ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey));

      if (!isFindShortcut) {
        return;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest("[data-find-replace-bar]")
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (!findCapable) {
        return;
      }

      event.preventDefault();
      setIsFindOpen(true);
      if (mode === "edit") {
        setShowReplace(true);
      } else if (!isFindOpen) {
        setShowReplace(false);
      }
      setFindFocusRequest(({ id }) => ({
        id: id + 1,
        target: "find",
      }));
    }

    window.addEventListener("keydown", handleFindShortcut);

    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, [findCapable, isFindOpen, mode]);

  function viewportTopFloor(): number {
    return toolbarRef.current?.getBoundingClientRect().bottom ?? 0;
  }

  const effectiveMarkdown = entry?.editedMarkdown ?? entry?.markdown ?? "";
  const largeMarkdownAnalysis = useMemo(() => {
    if (!entry || mode !== "preview" || entry.format.toLowerCase() !== "md") {
      return null;
    }
    return analyzeLargeMarkdown(effectiveMarkdown);
  }, [effectiveMarkdown, entry, mode]);
  const usesLargeJsonLightweightPreview = useMemo(
    () =>
      Boolean(
        entry &&
          entry.format.toLowerCase() === "json" &&
          getLargeJsonPreview(effectiveMarkdown),
      ),
    [effectiveMarkdown, entry],
  );
  const canEditFromEmptyState = Boolean(
    entry && (entry.isScratch || entry.editedMarkdown !== undefined),
  );
  // Only segment LinkedIn output when LinkedIn mode is mounted. The
  // refusal scan + Unicode line-map work is O(document) and used to be
  // gated on `mode === "linkedin"` before the split; without this gate,
  // every keystroke in Edit/Preview triggered the full computation.
  const linkedinPreviewState = useMemo(
    () =>
      mode === "linkedin" ? getLinkedInPreviewState(effectiveMarkdown) : null,
    [mode, effectiveMarkdown],
  );
  // Reactive enabled-state for the Format JSON toolbar button. Approximate by
  // design: the click handler re-reads the live textarea authoritatively and
  // no-ops on null, so a stale selection here can only under-enable (safe),
  // never trigger a wrong rewrite. Only computed in edit mode.
  const jsonFormatTarget = useMemo(
    () =>
      mode === "edit"
        ? detectJsonFormatTarget(
            effectiveMarkdown,
            editorSelection.start,
            editorSelection.end,
          )
        : null,
    [mode, effectiveMarkdown, editorSelection.start, editorSelection.end],
  );
  const showToggle = Boolean(
    entry &&
      (entry.status === "success" || entry.status === "warning") &&
      (entry.markdown.length > 0 || canEditFromEmptyState),
  );
  const copyText =
    mode === "linkedin"
      ? linkedinPreviewState?.refusal
        ? null
        : (linkedinPreviewState?.text ?? null)
      : effectiveMarkdown;
  const showCopyButton = showToggle && typeof copyText === "string";
  const autoFocusEditorOnMount = Boolean(
    editorFocusRequestId &&
      editorFocusRequestId > 0 &&
      editorFocusRequestTarget === "editor",
  );
  const activeFindSource =
    mode === "edit" ? effectiveMarkdown : renderedViewText;
  const editAnchor = useViewportAnchor(textareaRef, "textarea", {
    mirrorRef: usesLargeJsonLightweightPreview ? undefined : findHighlightRef,
    source: usesLargeJsonLightweightPreview ? "" : effectiveMarkdown,
    viewportTopFloor,
  });
  const renderedAnchor = useViewportAnchor(renderedViewRef, "rendered", {
    viewportTopFloor,
  });

  const isConverting =
    entry?.status === "pending" || entry?.status === "converting";
  const showConversionOverlay = isConverting || justFinishedConverting;

  const conversionOverlay = showConversionOverlay ? (
    <div className="conversion-overlay" aria-live="polite" aria-label="Loading">
      <div className="conversion-overlay-card">
        <span className="conversion-overlay-spinner" aria-hidden="true" />
        <p className="conversion-overlay-label">
          {isConverting ? "Converting…" : "Rendering preview…"}
        </p>
        <p className="conversion-overlay-sub">
          {isConverting
            ? "Processing locally—no data leaves your device."
            : "Building your Markdown view."}
        </p>
      </div>
    </div>
  ) : null;

  if (
    !entry ||
    entry.status === "pending" ||
    entry.status === "converting" ||
    entry.status === "error" ||
    (entry.markdown.length === 0 && !canEditFromEmptyState)
  ) {
    return (
      <>
        {conversionOverlay}
        <PreviewEmptyStates
          entry={entry}
          canEditFromEmptyState={canEditFromEmptyState}
          onStartWriting={onStartWriting}
        />
      </>
    );
  }

  function captureAnchorLine(): number | null {
    return mode === "edit"
      ? editAnchor.captureAnchorLine()
      : renderedAnchor.captureAnchorLine();
  }

  function switchMode(nextMode: "edit" | "preview" | "linkedin") {
    if (nextMode === mode) {
      return;
    }

    if (usesLargeJsonLightweightPreview) {
      pendingAnchorLineRef.current = null;
    } else {
      const captured = captureAnchorLine();
      if (captured !== null) {
        pendingAnchorLineRef.current = captured;
      }
    }
    suppressMatchCenteringForModeSwitchRef.current = activeFindMatch !== null;
    setMode(nextMode);
  }

  // Record the current viewport position for the active document as the user
  // scrolls/moves the caret. The anchor line is captured in whatever mode is
  // active; the exact edit caret/scroll is added only in edit mode. Preview
  // navigation reports an anchor-only state, which replaces (and so discards)
  // any stale edit caret for the document.
  function reportView() {
    if (entryId === null || !onEditorViewStateChange) {
      return;
    }
    const anchorLine = captureAnchorLine();
    const state: EditorViewState = {};
    if (anchorLine !== null) {
      state.anchorLine = anchorLine;
    }
    if (mode === "edit" && textareaRef.current) {
      const textarea = textareaRef.current;
      state.selectionStart = textarea.selectionStart;
      state.selectionEnd = textarea.selectionEnd;
      state.scrollTop = textarea.scrollTop;
    }
    if (state.anchorLine === undefined && state.selectionStart === undefined) {
      return;
    }
    onEditorViewStateChange(entryId, state);
  }

  // One-shot Format JSON action. Re-reads the LIVE textarea as the source of
  // truth (the reactive jsonFormatTarget is only used for enabled-state) and
  // commits through commitTargetedInsert so the format is a single native undo
  // step, mirroring EditMode's commitTargeted fallback. No-ops on null target,
  // so a click on a stale-enabled button can never rewrite a non-JSON target.
  function handleFormatJson() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const target = detectJsonFormatTarget(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    if (!target) {
      return;
    }
    const ok = commitTargetedInsert(textarea, target);
    if (!ok) {
      const nextValue =
        textarea.value.slice(0, target.start) +
        target.text +
        textarea.value.slice(target.end);
      onMarkdownChange?.(nextValue);
      window.setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) ta.setSelectionRange(target.caretStart, target.caretEnd);
      }, 0);
    }
    setEditorSelection({ start: target.caretStart, end: target.caretEnd });
  }

  const commonModeProps = {
    activeFindMatch,
    isFindOpen,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    viewportTopFloor,
  };

  return (
    <>
      {conversionOverlay}
    <div className="preview-body">
      <PreviewToolbar
        toolbarRef={toolbarRef}
        mode={mode}
        copyState={copyState}
        showToggle={showToggle}
        showCopyButton={showCopyButton}
        onSave={onSave}
        onDownloadMarkdown={onDownloadMarkdown}
        downloadMarkdownDisabled={downloadMarkdownDisabled}
        downloadMarkdownBusy={downloadMarkdownBusy}
        saveBusy={saveBusy}
        saveDisabled={saveDisabled}
        saveKeyShortcuts={saveKeyShortcuts}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        onExportHtml={onExportHtml}
        exportHtmlBusy={exportHtmlBusy}
        exportHtmlDisabled={exportHtmlDisabled}
        onNewDocument={onNewDocument}
        showFormatJson={mode === "edit"}
        formatJsonDisabled={jsonFormatTarget === null}
        onFormatJson={handleFormatJson}
        onModeChange={switchMode}
        onOpenFind={() => {
          setIsFindOpen(true);
          setShowReplace(mode === "edit");
          setFindFocusRequest(({ id }) => ({ id: id + 1, target: "find" }));
        }}
        onCopy={() =>
          performPreviewCopy({
            mode,
            copyText,
            previewElement: previewRef.current,
            onCopied: () => setCopyState("copied"),
          })
        }
      />

      {isFindOpen ? (
        <FindReplaceBar
          source={activeFindSource}
          onSourceChange={(nextMarkdown) => onMarkdownChange?.(nextMarkdown)}
          textareaRef={mode === "edit" ? textareaRef : undefined}
          onClose={() => {
            setIsFindOpen(false);
            setActiveFindMatch(null);
          }}
          showReplace={showReplace}
          onShowReplaceChange={setShowReplace}
          allowReplace={mode === "edit"}
          focusRequest={findFocusRequest}
          onActiveMatchChange={setActiveFindMatch}
        />
      ) : null}

      {entry.quality ? (
        <QualityIndicator quality={entry.quality} format={entry.format} />
      ) : null}

      {entry.warnings.length > 0 ? (
        <div className="warning-message" role="status">
          {entry.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {mode === "edit" ? (
        <EditMode
          {...commonModeProps}
          effectiveMarkdown={effectiveMarkdown}
          textareaRef={textareaRef}
          findHighlightRef={findHighlightRef}
          autoFocusOnMount={autoFocusEditorOnMount}
          anchorMirrorEnabled={!usesLargeJsonLightweightPreview}
          pendingEditorRestoreRef={pendingEditorRestoreRef}
          onReportView={reportView}
          onMarkdownChange={onMarkdownChange}
          onLargeMarkdownPaste={onLargeMarkdownPaste}
          onSelectionChange={(start, end) =>
            setEditorSelection({ start, end })
          }
        />
      ) : mode === "linkedin" && linkedinPreviewState ? (
        <LinkedInMode
          {...commonModeProps}
          state={linkedinPreviewState}
          renderedViewRef={renderedViewRef}
          renderedViewText={renderedViewText}
          onReportView={reportView}
          onRenderedViewTextChange={setRenderedViewText}
        />
      ) : (
        <PreviewMode
          {...commonModeProps}
          effectiveMarkdown={effectiveMarkdown}
          largeMarkdownAnalysis={largeMarkdownAnalysis}
          previewRef={previewRef}
          renderedViewRef={renderedViewRef}
          renderedViewText={renderedViewText}
          onReportView={reportView}
          onMarkdownChange={onMarkdownChange}
          onRenderedViewTextChange={setRenderedViewText}
        />
      )}
    </div>
    </>
  );
}
