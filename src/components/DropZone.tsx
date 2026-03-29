import { useRef, useState } from "react";
import { MAX_BROWSER_FILE_SIZE_BYTES } from "../converters/messages";
import { SUPPORTED_FORMATS } from "../types";

interface DropZoneProps {
  onFilesAdded: (files: FileList | File[]) => void;
}

export default function DropZone({ onFilesAdded }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const maxSizeInMb = Math.round(MAX_BROWSER_FILE_SIZE_BYTES / (1024 * 1024));

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    onFilesAdded(files);
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <div
      className={`drop-zone${isDragging ? " is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          openFilePicker();
        }
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

      <p className="drop-zone-kicker">Local conversion. No upload in the normal flow.</p>
      <p className="drop-zone-title">Drop files to convert</p>
      <p className="drop-zone-copy">
        Drag in one or more files, or{" "}
        <button
          type="button"
          className="inline-button"
          onClick={openFilePicker}
        >
          browse from your device
        </button>
        .
      </p>
      <div className="drop-zone-format-list" aria-label="Supported formats">
        {SUPPORTED_FORMATS.map((format) => (
          <span key={format} className="drop-zone-format-pill">
            .{format}
          </span>
        ))}
      </div>
      <p className="drop-zone-note">
        Supports mixed batches. Up to {maxSizeInMb} MB per file.
      </p>
    </div>
  );
}
