import type { FileEntry } from "../types";

export function displayName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function scratchDisplayName(
  editedMarkdown?: string,
  fallback = "Untitled.md",
): string {
  if (!editedMarkdown) {
    return displayName(fallback);
  }

  const firstLine = editedMarkdown
    .split(/\r?\n/u)
    .find((line) => line.trim().length > 0);

  if (!firstLine) {
    return displayName(fallback);
  }

  const cleaned = firstLine.replace(/^#+\s*/u, "").trim();

  if (cleaned.length === 0) {
    return displayName(fallback);
  }

  return cleaned.length > 40 ? `${cleaned.slice(0, 40).trimEnd()}...` : cleaned;
}

export function entryDisplayName(
  entry: Pick<FileEntry, "name" | "editedMarkdown" | "isScratch">,
) {
  return entry.isScratch
    ? scratchDisplayName(entry.editedMarkdown, entry.name)
    : displayName(entry.name);
}
