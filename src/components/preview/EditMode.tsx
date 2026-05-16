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
import { scrollTextareaToLine } from "../viewportAnchor";
import {
  convertClipboardPasteToMarkdown,
  type ClipboardPasteConversion,
} from "./pasteToMarkdown";
import { useViewportAnchor } from "./useViewportAnchor";

const LARGE_PASTE_MARKDOWN_LENGTH = 200;

interface TargetedInsert {
  start: number;
  end: number;
  text: string;
  caretStart: number;
  caretEnd: number;
}

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
  onMarkdownChange?: (markdown: string) => void;
  onLargeMarkdownPaste?: (markdown: string) => void;
}

/**
 * Replace [start, end) in `textarea.value` with `text` via a native input
 * event so the browser records ONE undo step. Synchronously sets the
 * post-insertion selection. Returns true on success.
 */
function commitTargetedInsert(
  textarea: HTMLTextAreaElement,
  insert: TargetedInsert,
): boolean {
  if (textarea.ownerDocument?.activeElement !== textarea) {
    textarea.focus();
  }
  if (textarea.ownerDocument?.activeElement !== textarea) {
    return false;
  }
  textarea.setSelectionRange(insert.start, insert.end);
  const exec = textarea.ownerDocument?.execCommand;
  if (typeof exec !== "function") {
    return false;
  }
  let ok: boolean;
  try {
    ok = exec.call(
      textarea.ownerDocument,
      "insertText",
      false,
      insert.text,
    );
  } catch {
    return false;
  }
  if (!ok) {
    return false;
  }
  textarea.setSelectionRange(insert.caretStart, insert.caretEnd);
  return true;
}

function targetedFromSelectionEdit(
  oldValue: string,
  newValue: string,
  selectionStart: number,
  selectionEnd: number,
): TargetedInsert {
  let prefixLen = 0;
  const minLen = Math.min(oldValue.length, newValue.length);
  while (
    prefixLen < minLen &&
    oldValue.charCodeAt(prefixLen) === newValue.charCodeAt(prefixLen)
  ) {
    prefixLen += 1;
  }
  let suffixLen = 0;
  while (
    suffixLen < oldValue.length - prefixLen &&
    suffixLen < newValue.length - prefixLen &&
    oldValue.charCodeAt(oldValue.length - 1 - suffixLen) ===
      newValue.charCodeAt(newValue.length - 1 - suffixLen)
  ) {
    suffixLen += 1;
  }
  return {
    start: prefixLen,
    end: oldValue.length - suffixLen,
    text: newValue.slice(prefixLen, newValue.length - suffixLen),
    caretStart: selectionStart,
    caretEnd: selectionEnd,
  };
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
  onMarkdownChange,
  onLargeMarkdownPaste,
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
    mirrorRef: findHighlightRef,
    source: effectiveMarkdown,
    viewportTopFloor,
    afterApply: syncFindHighlightScroll,
  });

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
      textarea.setSelectionRange(activeFindMatch.end, activeFindMatch.end);

      const matchLine =
        effectiveMarkdown.slice(0, activeFindMatch.start).split("\n").length;
      scrollTextareaToLine(
        textarea,
        findHighlightRef.current,
        effectiveMarkdown,
        matchLine,
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

  function handleEditorScroll() {
    syncFindHighlightScroll();
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

    if (markdown.length > LARGE_PASTE_MARKDOWN_LENGTH) {
      onLargeMarkdownPaste?.(markdown);
    }

    if (
      options.allowNativeUnchangedPlainText &&
      source !== "html" &&
      markdown === snapshot.plainText
    ) {
      return false;
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
          effectiveMarkdown,
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
      />
    </div>
  );
}
