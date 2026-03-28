import type { FileEntry } from "../types";
import { downloadEntry, isDownloadableEntry } from "../utils/download";

interface DownloadButtonProps {
  entry: FileEntry | null;
}

export default function DownloadButton({ entry }: DownloadButtonProps) {
  const isDownloadable = isDownloadableEntry(entry);

  function handleDownload() {
    if (!isDownloadable) {
      return;
    }

    downloadEntry(entry);
  }

  return (
    <button
      type="button"
      className="download-button"
      disabled={!isDownloadable}
      onClick={handleDownload}
    >
      Download selected
    </button>
  );
}
