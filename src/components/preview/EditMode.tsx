import { useCallback, useLayoutEffect, useRef } from "react";
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
import { useViewportAnchor } from "./useViewportAnchor";

interface TargetedInsert {
  start: number;
  end: number;
  text: string;
  caretStart: number;
  caretEnd: number;
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
}: EditModeProps) {
  const isComposingRef = useRef(false);
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
        onChange={(event) => onMarkdownChange?.(event.target.value)}
        onScroll={handleEditorScroll}
        onKeyDown={handleTextareaKeyDown}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        aria-label="Edit markdown"
      />
    </div>
  );
}
