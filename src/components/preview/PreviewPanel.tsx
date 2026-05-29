import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * Per-document edit-textarea position remembered across document switches so
 * returning to a large doc restores the caret and scroll instead of jumping
 * to the top. Owned/persisted by the adapter; PreviewPanel captures it on
 * leave and reapplies it on return.
 */
export interface EditorViewState {
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
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
  // Cross-document caret/scroll restore. Seeded in the entry-reset effect when
  // the selected entry changes and consumed + cleared once by EditMode when it
  // next mounts (entering edit mode). Non-scratch docs reset to preview mode on
  // open, so EditMode is unmounted when the seed lands and reads it fresh on
  // the later edit-mode mount.
  const pendingEditorRestoreRef = useRef<EditorViewState | null>(null);
  const entryId = entry?.id ?? null;
  const reportEditorViewState = useCallback(
    (state: EditorViewState) => {
      if (entryId !== null) {
        onEditorViewStateChange?.(entryId, state);
      }
    },
    [entryId, onEditorViewStateChange],
  );
  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  // Reset shell state when the loaded entry changes. The two refs are
  // anchor-handoff sentinels that must reset in lockstep with React state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entry-reset (see comment above)
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
    setActiveFindMatch(null);
    setRenderedViewText("");
    pendingAnchorLineRef.current = null;
    suppressMatchCenteringForModeSwitchRef.current = false;
    pendingEditorRestoreRef.current = entry?.id
      ? (getSavedEditorViewState?.(entry.id) ?? null)
      : null;
  }, [entry?.id, entry?.isScratch, getSavedEditorViewState]);

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
          onReportViewState={reportEditorViewState}
          onMarkdownChange={onMarkdownChange}
          onLargeMarkdownPaste={onLargeMarkdownPaste}
        />
      ) : mode === "linkedin" && linkedinPreviewState ? (
        <LinkedInMode
          {...commonModeProps}
          state={linkedinPreviewState}
          renderedViewRef={renderedViewRef}
          renderedViewText={renderedViewText}
          onRenderedViewTextChange={setRenderedViewText}
        />
      ) : (
        <PreviewMode
          {...commonModeProps}
          effectiveMarkdown={effectiveMarkdown}
          previewRef={previewRef}
          renderedViewRef={renderedViewRef}
          renderedViewText={renderedViewText}
          onRenderedViewTextChange={setRenderedViewText}
        />
      )}
    </div>
  );
}
