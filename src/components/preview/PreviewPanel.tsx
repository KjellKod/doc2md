import { useEffect, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../../types";
import type { SaveState } from "../../types/saveState";
import FindReplaceBar from "../FindReplaceBar";
import PdfQualityIndicator from "../PdfQualityIndicator";
import { useViewportAnchor } from "./useViewportAnchor";
import type { FindMatch } from "../useFindReplace";
import EditMode from "./EditMode";
import LinkedInMode, { getLinkedInPreviewState } from "./LinkedInMode";
import PreviewEmptyStates from "./PreviewEmptyStates";
import PreviewMode from "./PreviewMode";
import PreviewToolbar from "./PreviewToolbar";
import { performPreviewCopy } from "./previewCopy";
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
  saveBusy?: boolean;
  saveDisabled?: boolean;
  saveKeyShortcuts?: string;
  saveState?: SaveState;
  lastSavedAt?: number | null;
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
  saveBusy = false,
  saveDisabled = false,
  saveKeyShortcuts,
  saveState = "saved",
  lastSavedAt = null,
  onStartWriting,
  onNewDocument,
  editorFocusRequest,
  onLargeMarkdownPaste,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<"edit" | "preview" | "linkedin">("preview");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [activeFindMatch, setActiveFindMatch] = useState<FindMatch | null>(null);
  const [renderedViewText, setRenderedViewText] = useState("");
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

  // Derived-ref handoff: seed the pending viewport line the moment the selected
  // entry changes, DURING render, so the child mode component reads it on the
  // same commit (parent effects run after child effects — too late for the
  // common case where preview stays mounted across a document switch). This
  // mirrors how switchMode seeds the ref synchronously before remounting.
  const previousEntryIdRef = useRef<string | null | undefined>(undefined);
  if (entryId !== previousEntryIdRef.current) {
    previousEntryIdRef.current = entryId;
    const saved = entryId ? getSavedEditorViewState?.(entryId) : undefined;
    /* eslint-disable react-hooks/refs -- derived handoff before child mode effects (see note above) */
    pendingAnchorLineRef.current = saved?.anchorLine ?? null;
    pendingEditorRestoreRef.current =
      saved && saved.selectionStart != null ? saved : null;
    /* eslint-enable react-hooks/refs */
  }

  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  // Reset shell state when the loaded entry changes. The pending anchor +
  // editor-restore refs are seeded during render (see the derived-ref handoff
  // above); this effect owns only the React state resets.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entry-reset (see comment above)
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
    setActiveFindMatch(null);
    setRenderedViewText("");
    suppressMatchCenteringForModeSwitchRef.current = false;
  }, [entry?.id, entry?.isScratch]);

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
    mirrorRef: findHighlightRef,
    source: effectiveMarkdown,
    viewportTopFloor,
  });
  const renderedAnchor = useViewportAnchor(renderedViewRef, "rendered", {
    viewportTopFloor,
  });

  if (
    !entry ||
    entry.status === "pending" ||
    entry.status === "converting" ||
    entry.status === "error" ||
    (entry.markdown.length === 0 && !canEditFromEmptyState)
  ) {
    return (
      <PreviewEmptyStates
        entry={entry}
        canEditFromEmptyState={canEditFromEmptyState}
        onStartWriting={onStartWriting}
      />
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

    const captured = captureAnchorLine();
    if (captured !== null) {
      pendingAnchorLineRef.current = captured;
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

  const commonModeProps = {
    activeFindMatch,
    isFindOpen,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    viewportTopFloor,
  };

  return (
    <div className="preview-body">
      <PreviewToolbar
        toolbarRef={toolbarRef}
        mode={mode}
        copyState={copyState}
        showToggle={showToggle}
        showCopyButton={showCopyButton}
        onSave={onSave}
        saveBusy={saveBusy}
        saveDisabled={saveDisabled}
        saveKeyShortcuts={saveKeyShortcuts}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        onNewDocument={onNewDocument}
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

      {entry.format === "pdf" && entry.quality ? (
        <PdfQualityIndicator quality={entry.quality} />
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
          pendingEditorRestoreRef={pendingEditorRestoreRef}
          onReportView={reportView}
          onMarkdownChange={onMarkdownChange}
          onLargeMarkdownPaste={onLargeMarkdownPaste}
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
          previewRef={previewRef}
          renderedViewRef={renderedViewRef}
          renderedViewText={renderedViewText}
          onReportView={reportView}
          onRenderedViewTextChange={setRenderedViewText}
        />
      )}
    </div>
  );
}
