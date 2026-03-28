import type { FileEntry } from "../types";

interface DownloadButtonProps {
  entry: FileEntry | null;
}

function createMarkdownFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${fileName}.md`;
  }

  return `${fileName.slice(0, dotIndex)}.md`;
}

export default function DownloadButton({ entry }: DownloadButtonProps) {
  const isDownloadable =
    entry !== null &&
    (entry.status === "success" || entry.status === "warning");

  function handleDownload() {
    if (!entry || !isDownloadable) {
      return;
    }

    const markdownBlob = new globalThis.Blob([entry.markdown], {
      type: "text/markdown;charset=utf-8"
    });
    const objectUrl = globalThis.URL.createObjectURL(markdownBlob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = createMarkdownFileName(entry.name);
    document.body.append(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL(objectUrl);
  }

  return (
    <button
      type="button"
      className="download-button"
      disabled={!isDownloadable}
      onClick={handleDownload}
    >
      Download .md
    </button>
  );
}
