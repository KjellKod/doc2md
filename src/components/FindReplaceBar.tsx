import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  ChevronDown,
  ChevronUp,
  Replace,
  Search,
  X,
} from "lucide-react";
import { useFindReplace } from "./useFindReplace";
import type { FindMatch } from "./useFindReplace";

interface FindReplaceBarProps {
  source: string;
  onSourceChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onClose: () => void;
  showReplace: boolean;
  onShowReplaceChange: (showReplace: boolean) => void;
  focusRequest: {
    id: number;
    target: "find" | "replace";
  };
  onActiveMatchChange: (match: FindMatch | null) => void;
}

export default function FindReplaceBar({
  source,
  onSourceChange,
  textareaRef,
  onClose,
  showReplace,
  onShowReplaceChange,
  focusRequest,
  onActiveMatchChange,
}: FindReplaceBarProps) {
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const findReplace = useFindReplace(source, onSourceChange);
  const { activeMatch, setActiveSelection } = findReplace;
  const countLabel =
    findReplace.total === 0
      ? "0"
      : `${findReplace.activeIndex + 1} of ${findReplace.total}${
          findReplace.capped ? "+" : ""
        }`;
  const statusLabel = findReplace.replaceStatus || countLabel;

  useEffect(() => {
    const focusTarget = focusRequest.target === "replace"
      ? replaceInputRef.current
      : findInputRef.current;

    focusTarget?.focus();
    focusTarget?.select();
  }, [focusRequest.id, focusRequest.target]);

  useEffect(() => {
    if (!showReplace) {
      return;
    }

    replaceInputRef.current?.focus();
    replaceInputRef.current?.select();
  }, [showReplace]);

  useEffect(() => {
    onActiveMatchChange(activeMatch);
    setActiveSelection(textareaRef.current);
  }, [
    activeMatch?.start,
    activeMatch?.end,
    activeMatch,
    onActiveMatchChange,
    setActiveSelection,
    textareaRef,
  ]);

  function close() {
    onClose();
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      event.ctrlKey &&
      !event.metaKey &&
      event.key.toLowerCase() === "h"
    ) {
      event.preventDefault();
      event.stopPropagation();
      onShowReplaceChange(true);
      window.setTimeout(() => {
        replaceInputRef.current?.focus();
        replaceInputRef.current?.select();
      }, 0);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  function handleFindKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (event.shiftKey) {
      findReplace.previous();
      return;
    }

    findReplace.next();
  }

  const replaceDisabled =
    Boolean(findReplace.error) || findReplace.matches.length === 0;

  return (
    <div
      className="find-replace-bar"
      data-find-replace-bar
      role="search"
      aria-label="Find and replace markdown"
      onKeyDown={handleKeyDown}
    >
      <div className="find-replace-find-row">
        <label className="find-replace-input-wrap">
          <span className="visually-hidden">Find markdown text</span>
          <Search className="find-replace-field-icon" aria-hidden="true" />
          <input
            ref={findInputRef}
            className="find-replace-input"
            value={findReplace.query}
            onChange={(event) => findReplace.setQuery(event.target.value)}
            onKeyDown={handleFindKeyDown}
            placeholder="Find"
            aria-label="Find markdown text"
            aria-invalid={findReplace.error ? "true" : "false"}
          />
        </label>
        <div className="find-replace-options" role="group" aria-label="Find options">
          <span className="find-replace-tooltip-wrap">
            <button
              type="button"
              className={`find-replace-option${
                findReplace.caseSensitive ? " is-active" : ""
              }`}
              onClick={() =>
                findReplace.setCaseSensitive(!findReplace.caseSensitive)
              }
              aria-label="Case-sensitive search"
              aria-pressed={findReplace.caseSensitive}
              aria-describedby="case-sensitive-tooltip"
            >
              Aa
            </button>
            <span
              id="case-sensitive-tooltip"
              role="tooltip"
              className="find-replace-tooltip"
            >
              Match case
            </span>
          </span>
          <span className="find-replace-tooltip-wrap">
            <button
              type="button"
              className={`find-replace-option${findReplace.regex ? " is-active" : ""}`}
              onClick={() => findReplace.setRegex(!findReplace.regex)}
              aria-label="Regex search"
              aria-pressed={findReplace.regex}
              aria-describedby="regex-search-tooltip"
            >
              .*
            </button>
            <span
              id="regex-search-tooltip"
              role="tooltip"
              className="find-replace-tooltip"
            >
              Use regex
            </span>
          </span>
        </div>
        <div className="find-replace-nav" role="group" aria-label="Match navigation">
          <button
            type="button"
            className="find-replace-icon-button"
            onClick={findReplace.previous}
            disabled={findReplace.matches.length === 0}
            aria-label="Previous match"
          >
            <ChevronUp aria-hidden="true" />
          </button>
          <button
            type="button"
            className="find-replace-icon-button"
            onClick={findReplace.next}
            disabled={findReplace.matches.length === 0}
            aria-label="Next match"
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        <span className="find-replace-count" aria-live="polite">
          {statusLabel}
        </span>
        {findReplace.error ? (
          <span className="find-replace-error" role="alert">
            {findReplace.error}
          </span>
        ) : null}
        <span className="find-replace-tooltip-wrap">
          <button
            type="button"
            className={`find-replace-option${showReplace ? " is-active" : ""}`}
            onClick={() => onShowReplaceChange(!showReplace)}
            aria-label={showReplace ? "Hide replace controls" : "Show replace controls"}
            aria-pressed={showReplace}
            aria-describedby="replace-toggle-tooltip"
          >
            <Replace aria-hidden="true" />
          </button>
          <span
            id="replace-toggle-tooltip"
            role="tooltip"
            className="find-replace-tooltip"
          >
            {showReplace ? "Hide replace" : "Show replace"}
          </span>
        </span>
      </div>
      {showReplace ? (
        <div className="find-replace-replace-row">
          <label className="find-replace-input-wrap">
            <span className="visually-hidden">Replacement text</span>
            <input
              ref={replaceInputRef}
              className="find-replace-input"
              value={findReplace.replacement}
              onChange={(event) =>
                findReplace.setReplacement(event.target.value)
              }
              placeholder="Replace"
              aria-label="Replacement text"
            />
          </label>
          <div className="find-replace-replace-actions">
            <button
              type="button"
              className="find-replace-action-button"
              onClick={findReplace.replaceCurrent}
              disabled={replaceDisabled}
            >
              Replace
            </button>
            <button
              type="button"
              className="find-replace-action-button"
              onClick={findReplace.replaceAll}
              disabled={Boolean(findReplace.error) || findReplace.query.length === 0}
            >
              All
            </button>
          </div>
        </div>
      ) : null}
      <span className="find-replace-tooltip-wrap find-replace-close-wrap">
        <button
          type="button"
          className="find-replace-icon-button"
          onClick={close}
          aria-label="Close find and replace"
          aria-describedby="find-close-tooltip"
        >
          <X aria-hidden="true" />
        </button>
        <span
          id="find-close-tooltip"
          role="tooltip"
          className="find-replace-tooltip find-replace-tooltip-left"
        >
          Close
        </span>
      </span>
    </div>
  );
}
