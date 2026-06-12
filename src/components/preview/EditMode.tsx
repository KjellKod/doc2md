import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FindMatch } from "../useFindReplace";
import {
  insertLink,
  smartWrapInsert,
  toggleListLine,
  wrapSelection,
  type ListKind,
} from "../markdownFormatting";
import { computeAutoContinueEdit } from "../markdownAutoContinue";
import { scrollTextareaToOffset } from "../viewportAnchor";
import {
  convertClipboardPasteToMarkdown,
  type ClipboardPasteConversion,
} from "./pasteToMarkdown";
import { useViewportAnchor } from "./useViewportAnchor";
import {
  commitTargetedInsert,
  targetedFromSelectionEdit,
  type TargetedInsert,
} from "./targetedTextareaEdit";
import type { EditorViewState } from "./PreviewPanel";

const LARGE_PASTE_MARKDOWN_LENGTH = 200;

interface PasteSnapshot {
  html: string;
  plainText: string;
  selectionStart: number;
  selectionEnd: number;
  value: string;
}

interface MutableElementRef<T> {
  current: T | null;
}

interface EditModeProps {
  effectiveMarkdown: string;
  isFindOpen: boolean;
  activeFindMatch: FindMatch | null;
  textareaRef: MutableElementRef<HTMLTextAreaElement>;
  findHighlightRef: MutableElementRef<HTMLPreElement>;
  pendingAnchorLineRef: MutableElementRef<number>;
  suppressMatchCenteringForModeSwitchRef: MutableElementRef<boolean>;
  viewportTopFloor: () => number;
  autoFocusOnMount?: boolean;
  anchorMirrorEnabled?: boolean;
  pendingEditorRestoreRef?: MutableElementRef<EditorViewState>;
  onReportView?: () => void;
  onMarkdownChange?: (markdown: string) => void;
  onLargeMarkdownPaste?: (markdown: string) => void;
  onSelectionChange?: (start: number, end: number) => void;
}

function renderFindHighlight(source: string, match: FindMatch | null) {
  if (!match) {
    return source;
  }

  if (match.start === match.end) {
    return (
      <>
        {source.slice(0, match.start)}
        <mark className="markdown-find-highlight markdown-find-highlight-zero">
          {" "}
        </mark>
        {source.slice(match.end)}
      </>
    );
  }

  return (
    <>
      {source.slice(0, match.start)}
      <mark className="markdown-find-highlight">
        {source.slice(match.start, match.end)}
      </mark>
      {source.slice(match.end)}
    </>
  );
}

export default function EditMode({
  effectiveMarkdown,
  isFindOpen,
  activeFindMatch,
  textareaRef,
  findHighlightRef,
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  viewportTopFloor,
  autoFocusOnMount = false,
  anchorMirrorEnabled = true,
  pendingEditorRestoreRef,
  onReportView,
  onMarkdownChange,
  onLargeMarkdownPaste,
  onSelectionChange,
}: EditModeProps) {
  const isComposingRef = useRef(false);
  const pasteConversionActiveRef = useRef(false);
  const pasteConversionJobRef = useRef(0);
  const pasteConversionFrameRef = useRef<number | null>(null);
  const pasteConversionTimerRef = useRef<number | null>(null);
  const allowPasteCommitChangeRef = useRef(false);
  const [isPasteConverting, setIsPasteConverting] = useState(false);
  const syncFindHighlightScroll = useCallback(() => {
    if (!textareaRef.current || !findHighlightRef.current) {
      return;
    }

    findHighlightRef.current.scrollTop = textareaRef.current.scrollTop;
    findHighlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, [findHighlightRef, textareaRef]);
  const { applyAnchorLine } = useViewportAnchor(textareaRef, "textarea", {
    mirrorRef: anchorMirrorEnabled ? findHighlightRef : undefined,
    source: anchorMirrorEnabled ? effectiveMarkdown : "",
    viewportTopFloor,
    afterApply: syncFindHighlightScroll,
  });
  const findOverlaySource =
    anchorMirrorEnabled || isFindOpen ? effectiveMarkdown : "";

  useLayoutEffect(() => {
    const anchorLine = pendingAnchorLineRef.current;
    if (anchorLine === null) {
      return;
    }
    if (!applyAnchorLine(anchorLine)) {
      return;
    }
    pendingAnchorLineRef.current = null;
    window.setTimeout(() => {
      suppressMatchCenteringForModeSwitchRef.current = false;
    }, 0);
  }, [
    applyAnchorLine,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
  ]);

  useLayoutEffect(() => {
    if (
      isFindOpen &&
      activeFindMatch &&
      textareaRef.current &&
      pendingAnchorLineRef.current === null &&
      !suppressMatchCenteringForModeSwitchRef.current
    ) {
      const textarea = textareaRef.current;
      if (textarea.ownerDocument?.activeElement === textarea) {
        syncFindHighlightScroll();
        return;
      }

      textarea.setSelectionRange(activeFindMatch.end, activeFindMatch.end);

      scrollTextareaToOffset(
        textarea,
        findHighlightRef.current,
        effectiveMarkdown,
        activeFindMatch.start,
        viewportTopFloor(),
        0.5,
      );
      syncFindHighlightScroll();
    }
  }, [
    activeFindMatch?.end,
    activeFindMatch?.start,
    activeFindMatch,
    effectiveMarkdown,
    isFindOpen,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
    syncFindHighlightScroll,
    textareaRef,
    findHighlightRef,
    viewportTopFloor,
  ]);

  // Restore the remembered caret + scroll for this document. Seeded by
  // PreviewPanel on document change and consumed once; keyed on
  // effectiveMarkdown so it fires both on mount (entering edit mode) and when
  // a new document's content swaps in while edit mode is already open. On a
  // same-document mode switch the ref is null, so this is inert and the
  // pending-anchor handoff above owns the viewport.
  useLayoutEffect(() => {
    const restore = pendingEditorRestoreRef?.current;
    if (!restore) {
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    pendingEditorRestoreRef.current = null;
    const max = textarea.value.length;
    const start = Math.min(Math.max(restore.selectionStart ?? 0, 0), max);
    const end = Math.min(Math.max(restore.selectionEnd ?? start, 0), max);
    textarea.setSelectionRange(start, end);
    if (restore.scrollTop != null) {
      textarea.scrollTop = restore.scrollTop;
    }
    syncFindHighlightScroll();
  }, [effectiveMarkdown, pendingEditorRestoreRef, textareaRef, syncFindHighlightScroll]);

  // Report the initial selection once the textarea is mounted so the toolbar's
  // Format JSON enabled-state is correct before the user moves the caret. This
  // is JSON-agnostic; it only lifts the live selection range.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      onSelectionChange?.(textarea.selectionStart, textarea.selectionEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial selection report
  }, []);

  function handleEditorScroll() {
    syncFindHighlightScroll();
    onReportView?.();
  }

  const clearPasteConversionTimers = useCallback(() => {
    if (pasteConversionFrameRef.current !== null) {
      window.cancelAnimationFrame(pasteConversionFrameRef.current);
      pasteConversionFrameRef.current = null;
    }
    if (pasteConversionTimerRef.current !== null) {
      window.clearTimeout(pasteConversionTimerRef.current);
      pasteConversionTimerRef.current = null;
    }
  }, []);

  function finishPasteConversion(jobId: number) {
    if (pasteConversionJobRef.current !== jobId) return;
    clearPasteConversionTimers();
    pasteConversionActiveRef.current = false;
    setIsPasteConverting(false);
  }

  function beginPasteConversion() {
    clearPasteConversionTimers();
    const jobId = pasteConversionJobRef.current + 1;
    pasteConversionJobRef.current = jobId;
    pasteConversionActiveRef.current = true;
    if (textareaRef.current) {
      textareaRef.current.readOnly = true;
    }
    setIsPasteConverting(true);
    return jobId;
  }

  function applyPasteConversion(
    snapshot: PasteSnapshot,
    conversion: ClipboardPasteConversion,
    options: { allowNativeUnchangedPlainText: boolean },
  ) {
    const { markdown, source } = conversion;

    if (source === "empty") {
      return false;
    }

    if (
      options.allowNativeUnchangedPlainText &&
      source !== "html" &&
      markdown === snapshot.plainText
    ) {
      if (markdown.length > LARGE_PASTE_MARKDOWN_LENGTH) {
        window.setTimeout(() => onLargeMarkdownPaste?.(markdown), 0);
      }
      return false;
    }

    if (markdown.length > LARGE_PASTE_MARKDOWN_LENGTH) {
      onLargeMarkdownPaste?.(markdown);
    }

    const nextValue =
      snapshot.value.slice(0, snapshot.selectionStart) +
      markdown +
      snapshot.value.slice(snapshot.selectionEnd);
    const caret = snapshot.selectionStart + markdown.length;

    commitTargeted(
      {
        start: snapshot.selectionStart,
        end: snapshot.selectionEnd,
        text: markdown,
        caretStart: caret,
        caretEnd: caret,
      },
      nextValue,
    );
    return true;
  }

  function scheduleHtmlPasteConversion(snapshot: PasteSnapshot) {
    const jobId = beginPasteConversion();
    const runConversion = () => {
      pasteConversionTimerRef.current = null;
      if (pasteConversionJobRef.current !== jobId) return;

      try {
        const textarea = textareaRef.current;
        if (!textarea || textarea.value !== snapshot.value) return;

        textarea.readOnly = false;
        allowPasteCommitChangeRef.current = true;
        applyPasteConversion(
          snapshot,
          convertClipboardPasteToMarkdown({
            html: snapshot.html,
            plainText: snapshot.plainText,
          }),
          { allowNativeUnchangedPlainText: false },
        );
      } finally {
        allowPasteCommitChangeRef.current = false;
        finishPasteConversion(jobId);
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      pasteConversionFrameRef.current = window.requestAnimationFrame(() => {
        pasteConversionFrameRef.current = null;
        pasteConversionTimerRef.current = window.setTimeout(runConversion, 0);
      });
      return;
    }

    pasteConversionTimerRef.current = window.setTimeout(runConversion, 0);
  }

  function handleTextareaPaste(
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) {
    if (pasteConversionActiveRef.current) {
      event.preventDefault();
      return;
    }

    const textarea = event.currentTarget;
    const plainText = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");
    const snapshot: PasteSnapshot = {
      html,
      plainText,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      value: textarea.value,
    };

    if (html.trim().length > 0) {
      event.preventDefault();
      scheduleHtmlPasteConversion(snapshot);
      return;
    }

    const conversion = convertClipboardPasteToMarkdown({
      html,
      plainText,
    });

    if (conversion.source === "empty") {
      return;
    }

    const handled = applyPasteConversion(snapshot, conversion, {
      allowNativeUnchangedPlainText: true,
    });
    if (!handled) {
      return;
    }

    event.preventDefault();
  }

  function handleTextareaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (pasteConversionActiveRef.current && !allowPasteCommitChangeRef.current) {
      return;
    }
    onMarkdownChange?.(event.target.value);
  }

  useEffect(() => {
    return () => {
      pasteConversionJobRef.current += 1;
      pasteConversionActiveRef.current = false;
      clearPasteConversionTimers();
    };
  }, [clearPasteConversionTimers]);

  function commitTargeted(insert: TargetedInsert, fallbackValue: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const ok = commitTargetedInsert(textarea, insert);
    if (!ok) {
      onMarkdownChange?.(fallbackValue);
      window.setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) ta.setSelectionRange(insert.caretStart, insert.caretEnd);
      }, 0);
    }
  }

  function commitSelectionEditTargeted(
    oldValue: string,
    edit: { value: string; selectionStart: number; selectionEnd: number },
  ) {
    commitTargeted(
      targetedFromSelectionEdit(
        oldValue,
        edit.value,
        edit.selectionStart,
        edit.selectionEnd,
      ),
      edit.value,
    );
  }

  function handleTextareaKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.nativeEvent.isComposing || isComposingRef.current) {
      return;
    }

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const value = textarea.value;
    const isMeta = event.metaKey || event.ctrlKey;

    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !isMeta) {
      const edit = computeAutoContinueEdit(value, selectionStart, selectionEnd);
      if (edit) {
        event.preventDefault();
        const insert = targetedFromSelectionEdit(
          value,
          edit.value,
          edit.caretPos,
          edit.caretPos,
        );
        commitTargeted(insert, edit.value);
      }
      return;
    }

    if (isMeta && !event.altKey && !event.shiftKey) {
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        commitSelectionEditTargeted(
          value,
          wrapSelection(value, selectionStart, selectionEnd, "**"),
        );
        return;
      }
      if (key === "i") {
        event.preventDefault();
        commitSelectionEditTargeted(
          value,
          wrapSelection(value, selectionStart, selectionEnd, "_"),
        );
        return;
      }
      if (key === "k") {
        event.preventDefault();
        commitSelectionEditTargeted(
          value,
          insertLink(value, selectionStart, selectionEnd),
        );
        return;
      }
    }

    if (isMeta && event.shiftKey && !event.altKey) {
      let kind: ListKind | null = null;
      if (event.key === "7" || event.key === "&") kind = "ordered";
      else if (event.key === "8" || event.key === "*") kind = "unordered";
      else if (event.key === "9" || event.key === "(") kind = "task";
      if (kind !== null) {
        event.preventDefault();
        commitSelectionEditTargeted(
          value,
          toggleListLine(value, selectionStart, selectionEnd, kind),
        );
      }
    }

    if (
      !isMeta &&
      !event.altKey &&
      selectionStart !== selectionEnd &&
      event.key.length === 1 &&
      "*_`[(\"".includes(event.key)
    ) {
      const edit = smartWrapInsert(
        value,
        selectionStart,
        selectionEnd,
        event.key,
      );
      if (edit) {
        event.preventDefault();
        commitSelectionEditTargeted(value, edit);
      }
    }
  }

  return (
    <div className="markdown-edit-shell">
      {isPasteConverting ? (
        <div
          className="markdown-paste-status"
          role="status"
          aria-live="polite"
        >
          <span className="markdown-paste-spinner" aria-hidden="true" />
          Converting paste...
        </div>
      ) : null}
      <pre
        ref={(element) => {
          findHighlightRef.current = element;
        }}
        className="markdown-find-overlay"
        aria-hidden="true"
      >
        {renderFindHighlight(
          findOverlaySource,
          isFindOpen ? activeFindMatch : null,
        )}
      </pre>
      <textarea
        ref={(element) => {
          textareaRef.current = element;
        }}
        className="markdown-edit-area"
        value={effectiveMarkdown}
        onChange={handleTextareaChange}
        onPaste={handleTextareaPaste}
        onScroll={handleEditorScroll}
        onSelect={(event) => {
          onReportView?.();
          onSelectionChange?.(
            event.currentTarget.selectionStart,
            event.currentTarget.selectionEnd,
          );
        }}
        onKeyDown={handleTextareaKeyDown}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        aria-label="Edit markdown"
        aria-busy={isPasteConverting}
        readOnly={isPasteConverting}
        autoFocus={autoFocusOnMount}
      />
    </div>
  );
}
