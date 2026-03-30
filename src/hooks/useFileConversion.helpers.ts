import { getFileExtension } from "../converters";
import { CORRUPT_FILE_MESSAGE, TIMEOUT_MESSAGE } from "../converters/messages";
import type { ConversionResult } from "../converters/types";
import type { FileEntry } from "../types";

export function createEntryId(
  fileName: string,
  index: number,
  now = Date.now(),
  random = Math.round(Math.random() * 1_000_000),
) {
  const normalizedName = fileName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return `${normalizedName}-${now}-${index}-${random}`;
}

export function createPendingEntry(
  file: File,
  index: number,
  selected: boolean,
): FileEntry {
  const extension = getFileExtension(file.name);

  return {
    id: createEntryId(file.name, index),
    file,
    name: file.name,
    format: extension || "unknown",
    status: "pending",
    markdown: "",
    warnings: [],
    selected,
  };
}

export function createPendingEntries(files: File[], hasSelection: boolean) {
  return files.map((file, index) =>
    createPendingEntry(file, index, !hasSelection && index === 0),
  );
}

export function createScratchEntry(): FileEntry {
  return {
    id: createEntryId("untitled.md", 0),
    file: new File([], "Untitled.md", { type: "text/markdown" }),
    name: "Untitled.md",
    format: "md",
    status: "success",
    markdown: "",
    editedMarkdown: "",
    warnings: [],
    selected: true,
    isScratch: true,
  };
}

export function markEntryConverting(entry: FileEntry): FileEntry {
  return {
    ...entry,
    status: "converting",
    warnings: [],
  };
}

export function applyConversionResult(
  entry: FileEntry,
  result: ConversionResult,
): FileEntry {
  return {
    ...entry,
    markdown: result.markdown,
    warnings: result.warnings,
    status: result.status,
  };
}

export function getConversionFailureWarning(
  error: unknown,
  timeoutError: Error,
) {
  return error === timeoutError ? TIMEOUT_MESSAGE : CORRUPT_FILE_MESSAGE;
}

export function markEntryError(entry: FileEntry, warning: string): FileEntry {
  return {
    ...entry,
    markdown: "",
    warnings: [warning],
    status: "error",
  };
}
