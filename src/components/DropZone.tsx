import { useRef, useState } from "react";
import { MAX_BROWSER_FILE_SIZE_BYTES } from "../converters/messages";

interface DropZoneProps {
  onFilesAdded: (files: FileList | File[]) => void;
  onUrlAdded: (url: string) => Promise<void>;
  // When provided, the browse-file affordance routes through this callback
  // instead of the HTML file input. The desktop shell wires this to a native
  // openFile IPC so the selected file's disk path is captured for later
  // reload-from-disk operations. The browser-only build leaves it unset
  // and continues to use the HTML input (path-less by browser API).
  onNativeBrowse?: () => void | Promise<void>;
}

export default function DropZone({
  onFilesAdded,
  onUrlAdded,
  onNativeBrowse,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const maxSizeInMb = Math.round(MAX_BROWSER_FILE_SIZE_BYTES / (1024 * 1024));

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    onFilesAdded(files);
  }

  function openFilePicker() {
    if (onNativeBrowse) {
      void onNativeBrowse();
      return;
    }
    inputRef.current?.click();
  }

  async function handleUrlImport() {
    if (!urlValue.trim()) {
      setUrlError("Enter a document URL to import.");
      return;
    }

    setIsImportingUrl(true);
    setUrlError(null);

    try {
      await onUrlAdded(urlValue.trim());
      setUrlValue("");
    } catch (error) {
      setUrlError(
        error instanceof Error
          ? error.message
          : "We couldn't import that document URL.",
      );
    } finally {
      setIsImportingUrl(false);
    }
  }

  return (
    <div
      className={`drop-zone${isDragging ? " is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        // Open the file picker for any click in the drop area, except
        // when the user clicked an interactive child element that owns
        // its own click behavior (the inline "browse" button, the URL
        // form's input/button). Those elements either handle the click
        // themselves or stop propagation, so this `.closest()` check
        // covers anything that bubbles through to us.
        const target = event.target as Element | null;
        if (
          target?.closest("button, input, textarea, a, label, [contenteditable]")
        ) {
          return;
        }
        openFilePicker();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFilePicker();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

        if (dragDepthRef.current === 0) {
          setIsDragging(false);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.txt,.json,.csv,.tsv,.html,.docx,.xlsx,.pdf,.pptx,text/markdown,text/plain,application/json,text/csv,text/tab-separated-values,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <p className="drop-zone-kicker">
        YOUR FILES STAY ON YOUR DEVICE. NOTHING IS UPLOADED.
      </p>
      <p className="drop-zone-title">Drop files to convert</p>
      <p className="drop-zone-copy">
        Drag in one or more files, or{" "}
        <button
          type="button"
          className="inline-button"
          onClick={openFilePicker}
        >
          <svg
            className="inline-button-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M1.75 4.75a1.5 1.5 0 0 1 1.5-1.5H6l1.5 1.5h5.25a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5z" />
          </svg>
          browse from your device
        </button>
        .
      </p>
      <p className="drop-zone-note">
        Mix supported file types. URL imports must allow direct browser access.
        Up to {maxSizeInMb} MB each.
      </p>
      <form
        className="drop-zone-url-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleUrlImport();
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <label className="visually-hidden" htmlFor="remote-document-url">
          Document URL
        </label>
        <input
          id="remote-document-url"
          className="drop-zone-url-input"
          type="url"
          inputMode="url"
          placeholder="https://example.com/report.pdf"
          value={urlValue}
          onChange={(event) => {
            setUrlValue(event.target.value);
            if (urlError) {
              setUrlError(null);
            }
          }}
          disabled={isImportingUrl}
        />
        <button
          type="submit"
          className="secondary-button drop-zone-url-button"
          disabled={isImportingUrl}
        >
          {isImportingUrl ? "Importing..." : "Import URL"}
        </button>
      </form>
      {urlError ? (
        <p className="drop-zone-error" role="alert">
          {urlError}
        </p>
      ) : null}
    </div>
  );
}
