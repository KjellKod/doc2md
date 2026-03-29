import type { FileEntry } from "../types";

export function createMarkdownFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${fileName}.md`;
  }

  return `${fileName.slice(0, dotIndex)}.md`;
}

export function isDownloadableEntry(
  entry: FileEntry | null | undefined
): entry is FileEntry {
  return Boolean(
    entry && (entry.status === "success" || entry.status === "warning")
  );
}

function downloadMarkdownFile(fileName: string, markdown: string) {
  const markdownBlob = new globalThis.Blob([markdown], {
    type: "text/markdown;charset=utf-8"
  });
  const objectUrl = globalThis.URL.createObjectURL(markdownBlob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = createMarkdownFileName(fileName);
  document.body.append(link);
  link.click();
  setTimeout(() => {
    link.remove();
    globalThis.URL.revokeObjectURL(objectUrl);
  }, 1000);
}

export function downloadEntry(entry: FileEntry) {
  downloadMarkdownFile(entry.name, entry.editedMarkdown ?? entry.markdown);
}

export function downloadAllEntries(entries: FileEntry[]) {
  entries.filter(isDownloadableEntry).forEach((entry) => {
    downloadEntry(entry);
  });
}
