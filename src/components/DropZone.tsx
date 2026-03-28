import { useRef, useState } from "react";

interface DropZoneProps {
  onFilesAdded: (files: FileList | File[]) => void;
}

export default function DropZone({ onFilesAdded }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    onFilesAdded(files);
  }

  return (
    <div
      className={`drop-zone${isDragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".txt,.json,application/json,text/plain"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <p className="drop-zone-title">Drop files here</p>
      <p className="drop-zone-copy">
        Drag in one or more files, or{" "}
        <button
          type="button"
          className="inline-button"
          onClick={() => inputRef.current?.click()}
        >
          browse from your device
        </button>
        .
      </p>
      <p className="drop-zone-note">Current support: plain text and JSON.</p>
    </div>
  );
}
