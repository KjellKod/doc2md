import { useRef, useState } from "react";

import { markdownRename } from "../utils/markdownRename";

export default function RenameDocumentTitle({
  name,
  onRename,
  disabled = false,
}: {
  name: string;
  onRename: (name: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);

  function finish() {
    setEditing(false);
    requestAnimationFrame(() => title.current?.focus());
  }

  async function commit() {
    if (saving.current) return;
    try {
      const nextName = markdownRename(draft);
      saving.current = true;
      setBusy(true);
      await onRename(nextName);
      finish();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to rename this document.",
      );
      requestAnimationFrame(() => input.current?.focus());
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="document-title-rename">
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void commit();
          }}
        >
          <div className="document-title-input">
            <input
              ref={input}
              aria-label="Document name"
              value={draft}
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "rename-document-error" : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !busy) {
                  event.preventDefault();
                  finish();
                }
              }}
            />
            <span aria-hidden="true">.md</span>
            <button
              type="submit"
              disabled={busy}
              aria-label="Confirm document name"
              title="Confirm document name"
            >
              ✓
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label="Cancel rename"
              title="Cancel rename"
              onClick={finish}
            >
              ×
            </button>
          </div>
          {error && (
            <span id="rename-document-error" role="alert">
              {error}
            </span>
          )}
        </form>
      ) : (
        <button
          ref={title}
          className="document-title-button"
          type="button"
          disabled={disabled}
          title={`Rename ${name}`}
          aria-label={`Rename document: ${name}`}
          onClick={() => {
            setDraft(name.replace(/\.[^.]+$/u, ""));
            setError("");
            setEditing(true);
            requestAnimationFrame(() => {
              input.current?.focus();
              input.current?.select();
            });
          }}
        >
          {name}
        </button>
      )}
    </div>
  );
}
