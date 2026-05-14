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
import { copyMarkdownText, copyRenderedContent } from "./previewCopy";
export interface PreviewPanelProps {
  entry: FileEntry | null;
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
}

export default function PreviewPanel({
  entry,
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
  const findCapable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning") &&
    (entry.markdown.length > 0 ||
      entry.isScratch ||
      entry.editedMarkdown !== undefined);

  useEffect(() => {
    setMode(entry?.isScratch ? "edit" : "preview");
    setIsFindOpen(false);
    setActiveFindMatch(null);
    setRenderedViewText("");
    pendingAnchorLineRef.current = null;
    suppressMatchCenteringForModeSwitchRef.current = false;
  }, [entry?.id, entry?.isScratch]);

  useEffect(() => {
    if (!findCapable && isFindOpen) {
      setIsFindOpen(false);
      setActiveFindMatch(null);
    }
  }, [findCapable, isFindOpen]);

  if (mode !== "edit" && showReplace) {
    setShowReplace(false);
  }

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  useEffect(() => {
    if (
      editorFocusRequestId === undefined ||
      editorFocusRequestId === 0 ||
      editorFocusRequestTarget !== "editor"
    ) {
      return;
    }

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
        ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey));
      const isReplaceShortcut =
        key === "f" &&
        event.altKey &&
        ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey));

      if (!isFindShortcut && !isReplaceShortcut) {
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
      if (mode === "edit" || isReplaceShortcut) {
        setShowReplace(true);
      } else if (!isFindOpen) {
        setShowReplace(false);
      }
      setFindFocusRequest(({ id }) => ({
        id: id + 1,
        target: isReplaceShortcut && mode === "edit" ? "replace" : "find",
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
  const linkedinPreviewState = useMemo(
    () => getLinkedInPreviewState(effectiveMarkdown),
    [effectiveMarkdown],
  );
  const showToggle = Boolean(
    entry &&
      (entry.status === "success" || entry.status === "warning") &&
      (entry.markdown.length > 0 || canEditFromEmptyState),
  );
  const copyText =
    mode === "linkedin"
      ? linkedinPreviewState.refusal
        ? null
        : linkedinPreviewState.text
      : effectiveMarkdown;
  const showCopyButton = showToggle && typeof copyText === "string";
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

  function openFind(replace = false) {
    setIsFindOpen(true);
    setShowReplace(mode === "edit" || replace);
    setFindFocusRequest(({ id }) => ({
      id: id + 1,
      target: replace && mode === "edit" ? "replace" : "find",
    }));
  }

  function closeFind() {
    setIsFindOpen(false);
    setActiveFindMatch(null);
  }

  async function handleCopy() {
    if (!copyText) {
      return;
    }

    if (mode === "preview") {
      if (await copyRenderedContent(previewRef.current)) {
        setCopyState("copied");
      }

      return;
    }

    await copyMarkdownText(copyText);
    setCopyState("copied");
  }

  const showQualityIndicator = entry.format === "pdf" && entry.quality;
  const commonModeProps = {
    activeFindMatch,
    isFindOpen,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    viewportTopFloor,
  };
  const body =
    mode === "edit" ? (
      <EditMode
        {...commonModeProps}
        effectiveMarkdown={effectiveMarkdown}
        textareaRef={textareaRef}
        findHighlightRef={findHighlightRef}
        onMarkdownChange={onMarkdownChange}
      />
    ) : mode === "linkedin" ? (
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
    );

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
        onOpenFind={() => openFind(false)}
        onCopy={handleCopy}
      />

      {isFindOpen ? (
        <FindReplaceBar
          source={activeFindSource}
          onSourceChange={(nextMarkdown) => onMarkdownChange?.(nextMarkdown)}
          textareaRef={mode === "edit" ? textareaRef : undefined}
          onClose={closeFind}
          showReplace={showReplace}
          onShowReplaceChange={setShowReplace}
          allowReplace={mode === "edit"}
          focusRequest={findFocusRequest}
          onActiveMatchChange={setActiveFindMatch}
        />
      ) : null}

      {showQualityIndicator ? (
        <PdfQualityIndicator quality={entry.quality!} />
      ) : null}

      {entry.warnings.length > 0 ? (
        <div className="warning-message" role="status">
          {entry.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {body}
    </div>
  );
}
